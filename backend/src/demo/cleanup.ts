import userModel from "../models/user_model";
import itemModel from "../models/item_model";
import matchModel from "../models/match_model";
import chatModel from "../models/chat_model";
import notificationModel from "../models/notification_model";
import { ImageStorage, imageStorage } from "../images/storage";
import { logger } from "../lib/logger";

export const VISITOR_TTL_MS = 24 * 60 * 60 * 1000;

/** Deletes users and everything they own or take part in (items, sandbox copies, matches, chats, notifications, images). */
export const purgeUsers = async (userIds: string[], storage: ImageStorage = imageStorage) => {
  if (!userIds.length) return { users: 0, items: 0, matches: 0 };
  const items = await itemModel.find(
    { $or: [{ userId: { $in: userIds } }, { sandboxOwnerId: { $in: userIds } }] },
    { _id: 1, imagePublicId: 1 }
  );
  const itemIds = items.map((i) => i._id.toString());
  const matches = await matchModel.find(
    { $or: [{ userId1: { $in: userIds } }, { userId2: { $in: userIds } }, { item1Id: { $in: itemIds } }, { item2Id: { $in: itemIds } }] },
    { _id: 1 }
  );
  const matchIds = matches.map((m) => m._id.toString());

  await Promise.all([
    chatModel.deleteMany({ $or: [{ matchId: { $in: matchIds } }, { senderId: { $in: userIds } }, { receiverId: { $in: userIds } }] }),
    notificationModel.deleteMany({ $or: [{ matchId: { $in: matchIds } }, { userId: { $in: userIds } }] }),
    matchModel.deleteMany({ _id: { $in: matchIds } }),
  ]);
  // Sandbox copies share the template image and have no imagePublicId, so only owned images are removed.
  await Promise.all(
    items
      .filter((i) => i.imagePublicId)
      .map((i) => storage.remove(i.imagePublicId!).catch((err) => logger.warn({ err, publicId: i.imagePublicId }, "Failed to delete image")))
  );
  await itemModel.deleteMany({ _id: { $in: itemIds } });
  await userModel.deleteMany({ _id: { $in: userIds } });
  return { users: userIds.length, items: itemIds.length, matches: matchIds.length };
};

/** Removes demo visitors older than a day (run nightly). Seed bots and real users are never touched. */
export const cleanupExpiredVisitors = async (now = Date.now(), storage: ImageStorage = imageStorage) => {
  const expired = await userModel.find({ demoRole: "visitor", createdAt: { $lt: new Date(now - VISITOR_TTL_MS) } }, { _id: 1 });
  return purgeUsers(expired.map((u) => u._id.toString()), storage);
};
