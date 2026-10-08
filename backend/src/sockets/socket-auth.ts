import { Socket } from "socket.io";
import { verifyToken } from "../lib/tokens";

/** Socket.IO middleware: requires a valid access token in `handshake.auth.token`. */
export const socketAuth = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string") return next(new Error("unauthorized"));
  try {
    socket.data.userId = verifyToken(token, "access");
    next();
  } catch {
    next(new Error("unauthorized"));
  }
};
