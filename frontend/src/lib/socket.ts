import { io, Socket } from "socket.io-client";
import { env } from "./env";
import { tokens } from "./tokens";

const connect = (namespace: string) =>
  io(`${env.apiUrl}${namespace}`, {
    autoConnect: false,
    transports: ["websocket"],
    // read on every (re)connect so a refreshed token is picked up
    auth: (cb) => cb({ token: tokens.access() }),
  });

let notifications: Socket | null = null;
let chat: Socket | null = null;

/** Default namespace: item_status and match_notification for the signed-in user. */
export const notificationSocket = () => (notifications ??= connect(""));
/** /chat namespace. */
export const chatSocket = () => (chat ??= connect("/chat"));

export const disconnectSockets = () => {
  notifications?.disconnect();
  chat?.disconnect();
};
