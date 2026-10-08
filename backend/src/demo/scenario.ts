import bcrypt from "bcrypt";
import { randomInt, randomUUID } from "crypto";
import userModel from "../models/user_model";
import itemModel from "../models/item_model";
import matchModel from "../models/match_model";
import notificationModel from "../models/notification_model";
import chatModel from "../models/chat_model";
import demoTemplateModel, { DemoItemTemplate } from "../models/demo_template_model";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

/** Live visitor sandboxes allowed at once; the nightly cleanup removes ones older than a day. */
export const MAX_LIVE_VISITORS = 300;

const sandboxItem = (t: DemoItemTemplate, itemType: "lost" | "found", userId: string, visitorId: string) => ({
  ...t,
  itemType,
  userId,
  sandbox: true,
  sandboxOwnerId: visitorId,
  // The image is shared with every visitor's copy: no imagePublicId, so deleting a copy never deletes it.
  matchingStatus: "done" as const,
  matchCount: 1,
  attributes: {
    category: t.category,
    subcategory: "",
    brand: t.brand ?? "",
    model: "",
    colors: t.colors,
    material: "",
    distinctiveFeatures: [],
    visibleText: [],
    description: t.description,
  },
});

/**
 * Creates a private demo visitor with a ready scenario: their lost item, a found item owned
 * by a seed bot, an AI match between them, a notification and the bot's opening message.
 * Everything is sandboxed to this visitor, so no visitor can see or change another's demo.
 */
export const createVisitor = async () => {
  const template = await demoTemplateModel.findOne().sort({ createdAt: -1 }).lean();
  if (!template) throw new AppError(503, "DEMO_UNAVAILABLE", "The demo is being prepared. Try again in a minute.");
  if ((await userModel.countDocuments({ demoRole: "visitor" })) >= MAX_LIVE_VISITORS) {
    throw new AppError(503, "DEMO_BUSY", "The demo is busy right now. Try again later.");
  }

  const visitor = await userModel.create({
    email: `guest-${randomUUID()}@demo.eureka`,
    // nobody can log in with a password to a visitor account
    password: await bcrypt.hash(randomUUID(), 10),
    userName: `Guest ${randomInt(1000, 10000)}`,
    phoneNumber: " ",
    demoRole: "visitor",
  });
  const visitorId = visitor._id.toString();

  const [lost, found] = await itemModel.create([
    sandboxItem(template.lost, "lost", visitorId, visitorId),
    sandboxItem(template.found, "found", template.botId, visitorId),
  ]);
  const match = await matchModel.create({
    item1Id: found._id.toString(),
    userId1: template.botId,
    item2Id: lost._id.toString(),
    userId2: visitorId,
    matchScore: template.score,
    verdict: "match",
    reasons: template.reasons,
    conflicts: template.conflicts,
  });
  const matchId = match._id.toString();
  await notificationModel.create({
    userId: visitorId,
    matchId,
    type: "MATCH_FOUND",
    title: "Potential Match Found!",
    message: "We found a potential match for your lost item!",
  });
  await chatModel.create({ matchId, senderId: template.botId, receiverId: visitorId, content: template.firstMessage });

  logger.info({ visitorId }, "Demo visitor created");
  return { visitor, matchId };
};
