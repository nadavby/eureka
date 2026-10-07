import { Server, Namespace } from "socket.io";
import { Server as HttpServer } from "http";
import { initChatSocket } from "./chat.socket.service";
import { allowedOrigins } from "../middleware/security";
import { socketAuth } from "../sockets/socket-auth";
import { logger } from "../lib/logger";

let io: Server;
let chatNamespace: Namespace;

export const initSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
    },
  });

  io.use(socketAuth);
  io.on("connection", (socket) => {
    const userId: string = socket.data.userId;
    // Each user listens on a room named after their id; the token decides which one.
    socket.join(userId);
    logger.debug({ userId, socketId: socket.id }, "Notification socket connected");

    // Older clients still send this; the room was already chosen from the token.
    socket.on("authenticate", () => undefined);
    socket.on("disconnect", () => logger.debug({ userId, socketId: socket.id }, "Notification socket disconnected"));
  });

  chatNamespace = initChatSocket(io);
  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};

export const getChatNamespace = () => {
  if (!chatNamespace) throw new Error("Chat namespace not initialized");
  return chatNamespace;
};

// The same notification can be emitted twice in quick succession (both sides of a match);
// drop duplicates within a short window.
const recentNotifications = new Map<string, number>();
const NOTIFICATION_COOLDOWN_MS = 5000;

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of recentNotifications.entries()) {
    if (now - timestamp > NOTIFICATION_COOLDOWN_MS) recentNotifications.delete(key);
  }
}, NOTIFICATION_COOLDOWN_MS).unref();

export const emitNotification = (userId: string, notification: { _id?: unknown; matchId?: unknown }) => {
  try {
    const key = `${userId}_${notification._id ?? `${notification.matchId}_${Date.now()}`}`;
    if (recentNotifications.has(key)) return;
    recentNotifications.set(key, Date.now());
    getIO().to(userId).emit("match_notification", notification);
  } catch (err) {
    logger.error({ err, userId }, "Failed to emit notification");
  }
};
