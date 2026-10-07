import mongoose from "mongoose";
import { Server, Socket } from "socket.io";
import chatModel, { IChatMessage } from "../models/chat_model";
import matchModel from "../models/match_model";
import { socketAuth } from "../sockets/socket-auth";
import { logger } from "../lib/logger";
import { botReplyFor } from "../demo/bots";

const BOT_TYPING_DELAY_MS = 1500;

const MAX_MESSAGE_LENGTH = 2000;

interface UserChatInfo {
  matchId: string;
  otherUserId: string;
  lastMessage?: IChatMessage;
  unreadCount: number;
  isOnline?: boolean;
}

interface ChatAggregation {
  _id: string;
  lastMessage: IChatMessage;
  unreadCount: number;
}

/** Returns the match if `userId` takes part in it, otherwise null. */
const participantMatch = async (matchId: unknown, userId: string) => {
  if (typeof matchId !== "string" || !mongoose.isValidObjectId(matchId)) return null;
  const match = await matchModel.findById(matchId).lean();
  return match && (match.userId1 === userId || match.userId2 === userId) ? match : null;
};

const NOT_PARTICIPANT = { message: "You are not part of this match" };

export const initChatSocket = (io: Server) => {
  const chatNamespace = io.of("/chat");
  chatNamespace.use(socketAuth);

  // userId -> ids of that user's open sockets
  const userSockets = new Map<string, Set<string>>();
  const broadcastUserStatus = (userId: string, isOnline: boolean) =>
    chatNamespace.emit("user_status_changed", { userId, isOnline });

  chatNamespace.on("connection", (socket: Socket) => {
    const userId: string = socket.data.userId;

    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
      broadcastUserStatus(userId, true);
    }
    userSockets.get(userId)!.add(socket.id);
    logger.debug({ userId, socketId: socket.id }, "Chat socket connected");

    // Kept for older clients: identity already comes from the token.
    socket.on("register_user", () => {
      socket.emit("online_users", Array.from(userSockets.keys()));
    });
    socket.emit("online_users", Array.from(userSockets.keys()));

    socket.on("join_chat", async (matchId: unknown) => {
      try {
        if (!(await participantMatch(matchId, userId))) return socket.emit("error", NOT_PARTICIPANT);
        const room = matchId as string;
        socket.join(room);

        const messages = await chatModel.find({ matchId: room }).sort({ timestamp: 1 }).limit(100).lean();
        socket.emit("chat_history", messages);

        await chatModel.updateMany(
          { matchId: room, receiverId: userId, status: "sent" },
          { status: "delivered" }
        );
      } catch (err) {
        logger.error({ err, userId }, "Failed to join chat");
        socket.emit("error", { message: "Failed to load chat history" });
      }
    });

    socket.on("send_message", async (data: { matchId?: unknown; content?: unknown }) => {
      try {
        const match = socket.rooms.has(data?.matchId as string) ? await participantMatch(data.matchId, userId) : null;
        if (!match) return socket.emit("error", NOT_PARTICIPANT);

        const content = typeof data.content === "string" ? data.content.trim() : "";
        if (!content || content.length > MAX_MESSAGE_LENGTH) {
          return socket.emit("error", { message: `A message must be 1-${MAX_MESSAGE_LENGTH} characters` });
        }

        const message = await chatModel.create({
          matchId: data.matchId as string,
          senderId: userId,
          receiverId: match.userId1 === userId ? match.userId2 : match.userId1,
          content,
          status: "sent",
        });
        chatNamespace.to(message.matchId).emit("new_message", message);

        // Demo: a seed bot answers the visitor's first message, after a short "typing" pause.
        setTimeout(() => {
          botReplyFor(message.matchId, userId, message.receiverId)
            .then((reply) => reply && chatNamespace.to(reply.matchId).emit("new_message", reply))
            .catch((err) => logger.warn({ err }, "Demo bot reply failed"));
        }, BOT_TYPING_DELAY_MS).unref();
      } catch (err) {
        logger.error({ err, userId }, "Failed to send message");
        socket.emit("error", { message: "Failed to send message" });
      }
    });

    // Only the receiver of a message can mark it delivered or read.
    socket.on("update_message_status", async (data: { messageId?: unknown; status?: unknown }) => {
      try {
        if (!mongoose.isValidObjectId(data?.messageId)) return;
        if (data.status !== "delivered" && data.status !== "read") return;
        const message = await chatModel.findOneAndUpdate(
          { _id: data.messageId, receiverId: userId },
          { status: data.status },
          { new: true }
        );
        if (message) {
          chatNamespace.to(message.matchId).emit("message_status_updated", { messageId: message._id, status: data.status });
        }
      } catch (err) {
        logger.error({ err, userId }, "Failed to update message status");
      }
    });

    socket.on("get_user_chats", async () => {
      try {
        const userChats: ChatAggregation[] = await chatModel.aggregate([
          { $match: { $or: [{ senderId: userId }, { receiverId: userId }] } },
          { $sort: { timestamp: -1 } },
          {
            $group: {
              _id: "$matchId",
              lastMessage: { $first: "$$ROOT" },
              unreadCount: {
                $sum: {
                  $cond: [
                    { $and: [{ $ne: ["$senderId", userId] }, { $in: ["$status", ["sent", "delivered"]] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]);

        const chats: UserChatInfo[] = userChats.map((chat) => {
          const otherUserId =
            chat.lastMessage.senderId === userId ? chat.lastMessage.receiverId : chat.lastMessage.senderId;
          return {
            matchId: chat._id,
            otherUserId,
            lastMessage: chat.lastMessage,
            unreadCount: chat.unreadCount,
            isOnline: userSockets.has(otherUserId),
          };
        });
        socket.emit("user_chats", chats);
      } catch (err) {
        logger.error({ err, userId }, "Failed to load chats");
        socket.emit("error", { message: "Failed to load chats" });
      }
    });

    socket.on("leave_chat", (matchId: unknown) => {
      if (typeof matchId === "string") socket.leave(matchId);
    });

    socket.on("disconnect", () => {
      const sockets = userSockets.get(userId);
      sockets?.delete(socket.id);
      if (sockets?.size === 0) {
        userSockets.delete(userId);
        broadcastUserStatus(userId, false);
      }
      logger.debug({ userId, socketId: socket.id }, "Chat socket disconnected");
    });
  });

  return chatNamespace;
};
