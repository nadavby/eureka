import { Request, Response } from "express";
import matchModel from "../models/match_model";
import notificationModel from "../models/notification_model";
import itemModel from "../models/item_model";
import chatModel from "../models/chat_model";
import { badRequest, forbidden, notFound } from "../lib/errors";

const isParticipant = (match: { userId1: string; userId2: string }, userId: string) =>
  match.userId1 === userId || match.userId2 === userId;

/** Loads a match the user takes part in: 404 if it doesn't exist, 403 if it belongs to others. */
const loadOwnMatch = async (matchId: string, userId: string) => {
  const match = await matchModel.findById(matchId);
  if (!match) throw notFound("Match not found");
  if (!isParticipant(match, userId)) throw forbidden("You are not part of this match");
  return match;
};

const getAllByUserId = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  if (req.params.userId !== userId) throw forbidden("You can only list your own matches");
  res.json(await matchModel.find({ $or: [{ userId1: userId }, { userId2: userId }] }));
};

const getById = async (req: Request, res: Response) => {
  res.json(await loadOwnMatch(req.params.id, req.user!.id));
};

const deleteById = async (req: Request, res: Response) => {
  const match = await loadOwnMatch(req.params.id, req.user!.id);
  const matchId = match._id.toString();
  await notificationModel.deleteMany({ matchId });
  await chatModel.deleteMany({ matchId });
  await match.deleteOne();
  res.json({ message: "Match and associated notifications deleted successfully" });
};

/**
 * Each side confirms once. When both have confirmed, both items are resolved, the match is
 * marked confirmed (owners can now see each other's contact details) and every other match
 * on either item is removed with its chat and notifications.
 */
const confirmMatch = async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const match = await loadOwnMatch(req.body.matchId, userId);
  const matchId = match._id.toString();

  const isUser1 = match.userId1 === userId;
  if (isUser1 ? match.user1Confirmed : match.user2Confirmed) {
    throw badRequest("You have already confirmed this match");
  }

  await notificationModel.deleteMany({ matchId });
  const updated = await matchModel.findByIdAndUpdate(
    matchId,
    { $set: { [isUser1 ? "user1Confirmed" : "user2Confirmed"]: true } },
    { new: true }
  );
  if (!updated) throw notFound("Match not found");

  if (updated.user1Confirmed && updated.user2Confirmed) {
    const itemIds = [match.item1Id, match.item2Id];
    await itemModel.updateMany({ _id: { $in: itemIds } }, { isResolved: true });

    await matchModel.updateOne({ _id: matchId }, { confirmedAt: new Date() });

    // Every OTHER match on these two items is obsolete now; this one and its chat are kept.
    const related = await matchModel.find(
      { _id: { $ne: matchId }, $or: [{ item1Id: { $in: itemIds } }, { item2Id: { $in: itemIds } }] },
      { _id: 1 }
    );
    const relatedIds = related.map((m) => m._id.toString());
    await notificationModel.deleteMany({ matchId: { $in: relatedIds } });
    await chatModel.deleteMany({ matchId: { $in: relatedIds } });
    await matchModel.deleteMany({ _id: { $in: relatedIds } });

    res.json({
      message: "Match fully confirmed and completed",
      status: "FULLY_CONFIRMED",
      match: await matchModel.findById(matchId),
    });
    return;
  }

  res.json({
    message: "Match confirmation updated",
    status: "PARTIALLY_CONFIRMED",
    match: updated,
    userConfirmed: isUser1 ? "user1" : "user2",
    awaitingConfirmation: isUser1 ? "user2" : "user1",
  });
};

export default { getAllByUserId, getById, deleteById, confirmMatch };
