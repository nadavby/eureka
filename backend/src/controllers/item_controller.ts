import { Request, Response } from "express";
import itemModel from "../models/item_model";
import userModel from "../models/user_model";
import matchModel from "../models/match_model";
import notificationModel from "../models/notification_model";
import chatModel from "../models/chat_model";
import { badRequest, forbidden, notFound, unauthorized } from "../lib/errors";
import { queue } from "../jobs";
import { ANALYZE_ITEM } from "../matching";
import { removeStoredImage, storeUpload } from "../images";

/**
 * Saves the item and returns immediately. Matching runs in the background
 * (analyze-item -> find-matches) and reports progress over the socket as `item_status`.
 */
const uploadItem = async (req: Request, res: Response) => {
  const files = req.files as { [field: string]: Express.Multer.File[] } | undefined;
  const file = files?.file?.[0] || files?.image?.[0];
  if (!file) throw badRequest("Missing image: upload it as 'file' or 'image'");

  const userId = req.user!.id;
  if (!(await userModel.exists({ _id: userId }))) throw unauthorized("User no longer exists");

  const image = await storeUpload(file, "items");
  let item;
  try {
    item = await itemModel.create({
      ...req.body,
      userId,
      imageUrl: image.url,
      imagePublicId: image.publicId,
      matchingStatus: "analyzing",
      isResolved: false,
    });
  } catch (err) {
    await removeStoredImage(image.publicId); // don't leave an orphaned file behind
    throw err;
  }
  await queue.enqueue(ANALYZE_ITEM, { itemId: item._id.toString() });

  res.status(201).json(item);
};

const getAllItems = async (req: Request, res: Response) => {
  const query: Record<string, unknown> = {};
  if (req.query.itemType) query.itemType = req.query.itemType;
  if (req.query.userId) query.userId = req.query.userId;
  if (req.query.open === "true") query.isResolved = false;
  res.json(await itemModel.find(query).sort({ createdAt: -1 }));
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
  await removeStoredImage(item.imagePublicId);
  res.json({ message: "Item deleted successfully" });
};

export { uploadItem, getAllItems, getItemById, deleteItem };
