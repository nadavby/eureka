import { Request, Response } from "express";
import itemModel, { IItem } from "../models/item_model";
import userModel from "../models/user_model";
import matchModel, { IMatch } from "../models/match_model";
import notificationModel, { INotification } from "../models/notification_model";
import chatModel from "../models/chat_model";
import { emitNotification } from "../services/notification.socket.service";
import { MatchingService } from "../services/matching-service";
import visionService from "../services/vision-service";
import { config } from "../lib/config";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors";
import { logger } from "../lib/logger";

const MATCH_THRESHOLD = 70;

const findPotentialMatches = async (item: IItem) => {
  const oppositeType = item.itemType === "lost" ? "found" : "lost";
  const candidates = await itemModel.find({ itemType: oppositeType, isResolved: false });
  const matches = await MatchingService(item, candidates);
  return matches.map((m) => ({ item: m.item, score: m.confidenceScore }));
};

const analyzeImage = async (imageUrl: string): Promise<IItem["visionApiData"]> => {
  try {
    const analysis = await visionService.getImageAnalysis(imageUrl);
    return {
      labels: analysis.labels,
      objects: analysis.objects.map((obj) => ({
        name: obj.name,
        score: obj.score,
        boundingBox: obj.boundingBox || { x: 0, y: 0, width: 0, height: 0 },
      })),
      texts: analysis.texts,
      logos: analysis.logos,
    };
  } catch (err) {
    logger.warn({ err }, "Image analysis failed; continuing without vision data");
    return { labels: [], objects: [] };
  }
};

const notifyMatch = async (userId: string, matchId: string, itemType: string) => {
  const notification: INotification = {
    type: "MATCH_FOUND",
    title: "Potential Match Found!",
    message: `We found a potential match for your ${itemType} item!`,
    userId,
    matchId,
    isRead: false,
  };
  const saved = await notificationModel.create(notification);
  emitNotification(userId, saved);
};

const createMatches = async (savedItem: IItem & { _id: unknown }) => {
  const potentialMatches = await findPotentialMatches(savedItem);
  const strong = potentialMatches.filter((m) => m.score > MATCH_THRESHOLD);
  for (const { item: matchedItem, score } of strong) {
    if (!matchedItem._id) continue;
    const match: IMatch = {
      item1Id: String(matchedItem._id),
      userId1: matchedItem.userId,
      item2Id: String(savedItem._id),
      userId2: savedItem.userId,
      matchScore: score,
      user1Confirmed: false,
      user2Confirmed: false,
    };
    const savedMatch = await matchModel.create(match);
    const matchId = savedMatch._id.toString();
    await notifyMatch(matchedItem.userId, matchId, matchedItem.itemType);
    await notifyMatch(savedItem.userId, matchId, savedItem.itemType);
    logger.info({ matchId, score }, "Match created");
  }
};

const uploadItem = async (req: Request, res: Response) => {
  const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
  const file = files?.file?.[0] || files?.image?.[0];
  if (!file) throw badRequest("Missing image: upload it as 'file' or 'image'");

  const userId = req.user!.id;
  const user = await userModel.findById(userId);
  if (!user) throw unauthorized("User no longer exists");

  const imageUrl = `${config.DOMAIN_BASE}/public/items/${file.filename}`;
  const savedItem = await itemModel.create({
    ...req.body,
    userId,
    imageUrl,
    brand: req.body.brand || "",
    visionApiData: await analyzeImage(imageUrl),
    isResolved: false,
  });

  try {
    await createMatches(savedItem.toObject());
  } catch (err) {
    // The item is saved either way; matching failures must not fail the upload.
    logger.error({ err, itemId: savedItem._id }, "Matching failed");
  }

  res.status(201).json(savedItem);
};

const getAllItems = async (req: Request, res: Response) => {
  const query: Record<string, unknown> = {};
  if (req.query.itemType) query.itemType = req.query.itemType;
  if (req.query.userId) query.userId = req.query.userId;
  res.json(await itemModel.find(query));
};

const getItemById = async (req: Request, res: Response) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) throw notFound("Item not found");
  res.json(item);
};

const deleteItem = async (req: Request, res: Response) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) throw notFound("Item not found");
  if (item.userId !== req.user!.id) throw forbidden("You can only delete your own items");

  const matches = await matchModel.find({ $or: [{ item1Id: req.params.id }, { item2Id: req.params.id }] }, { _id: 1 });
  const matchIds = matches.map((m) => m._id.toString());
  await notificationModel.deleteMany({ matchId: { $in: matchIds } });
  await chatModel.deleteMany({ matchId: { $in: matchIds } });
  await matchModel.deleteMany({ _id: { $in: matchIds } });
  await item.deleteOne();
  res.json({ message: "Item deleted successfully" });
};

export { uploadItem, getAllItems, getItemById, deleteItem };
