import userModel from "../models/user_model";
import itemModel from "../models/item_model";
import chatModel from "../models/chat_model";
import demoTemplateModel from "../models/demo_template_model";
import { IMatch } from "../models/match_model";

export const isSeedBot = async (userId: string) => !!(await userModel.exists({ _id: userId, demoRole: "seed" }));

/**
 * Items that may be marked resolved when a match is confirmed. Public demo items (owned by a
 * seed bot and not sandboxed) stay open, so every visitor finds the same demo world.
 */
export const resolvableItemIds = async (itemIds: string[]) => {
  const items = await itemModel.find({ _id: { $in: itemIds } }, { userId: 1, sandbox: 1 }).lean();
  const bots = new Set(
    (await userModel.find({ _id: { $in: items.map((i) => i.userId) }, demoRole: "seed" }, { _id: 1 }).lean()).map((u) => String(u._id))
  );
  return items.filter((i) => i.sandbox || !bots.has(i.userId)).map((i) => String(i._id));
};

/** The other participant of a match, if it is a seed bot. */
export const botCounterpart = async (match: Pick<IMatch, "userId1" | "userId2">, userId: string) => {
  const other = match.userId1 === userId ? match.userId2 : match.userId1;
  return (await isSeedBot(other)) ? other : null;
};

const GENERIC_REPLY =
  "Thanks for writing! This is a demo account, so nothing will actually change hands, but this is where you'd agree on a time and place to meet.";

/**
 * A seed bot answers a visitor's first message in a conversation, once.
 * Returns the reply to deliver, or null when the bot should stay quiet.
 */
export const botReplyFor = async (matchId: string, visitorId: string, botId: string) => {
  if (!(await isSeedBot(botId))) return null;
  const [fromVisitor, fromBotAfterOpening] = await Promise.all([
    chatModel.countDocuments({ matchId, senderId: visitorId }),
    chatModel.countDocuments({ matchId, senderId: botId }),
  ]);
  // The starter scenario opens with one bot message; other matches start empty.
  const template = await demoTemplateModel.findOne({ botId }).sort({ createdAt: -1 }).lean();
  const isScenario = !!template && fromBotAfterOpening >= 1 && (await chatModel.exists({ matchId, senderId: botId, content: template.firstMessage }));
  const botAlreadyReplied = isScenario ? fromBotAfterOpening > 1 : fromBotAfterOpening > 0;
  if (fromVisitor !== 1 || botAlreadyReplied) return null;
  return chatModel.create({
    matchId,
    senderId: botId,
    receiverId: visitorId,
    content: isScenario ? template!.botReply : GENERIC_REPLY,
  });
};
