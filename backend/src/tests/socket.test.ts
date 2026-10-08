import http from "http";
import { AddressInfo } from "net";
import mongoose from "mongoose";
import { io as connectClient, Socket } from "socket.io-client";
import initApp from "../server";
import { emitNotification, initSocket } from "../services/notification.socket.service";
import { signAccessToken, signRefreshToken } from "../lib/tokens";
import matchModel from "../models/match_model";
import chatModel from "../models/chat_model";

let server: http.Server;
let url: string;
const alice = new mongoose.Types.ObjectId().toString();
const bob = new mongoose.Types.ObjectId().toString();
const mallory = new mongoose.Types.ObjectId().toString();
let matchId: string;
const sockets: Socket[] = [];

const connect = (namespace: string, token?: string) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = connectClient(`${url}${namespace}`, {
      auth: token ? { token } : {},
      transports: ["websocket"],
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
  });

const next = <T>(socket: Socket, event: string) => new Promise<T>((resolve) => socket.once(event, resolve));

beforeAll(async () => {
  const app = await initApp();
  server = http.createServer(app);
  initSocket(server);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
  const match = await matchModel.create({ item1Id: "s1", userId1: alice, item2Id: "s2", userId2: bob, matchScore: 80 });
  matchId = match._id.toString();
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  await chatModel.deleteMany({ matchId });
  await matchModel.deleteMany({ _id: matchId });
  await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.close();
});

describe("socket authentication", () => {
  it("rejects connections without a valid access token", async () => {
    await expect(connect("")).rejects.toThrow("unauthorized");
    await expect(connect("/chat", "garbage")).rejects.toThrow("unauthorized");
    await expect(connect("/chat", signRefreshToken(alice))).rejects.toThrow("unauthorized");
  });

  it("delivers notifications only to the authenticated user's room", async () => {
    const aliceSocket = await connect("", signAccessToken(alice));
    const mallorySocket = await connect("", signAccessToken(mallory));
    // the legacy "authenticate" event can no longer join someone else's room
    mallorySocket.emit("authenticate", { userId: alice });

    let malloryGotIt = false;
    mallorySocket.on("match_notification", () => (malloryGotIt = true));
    const received = next<{ _id: string }>(aliceSocket, "match_notification");
    await new Promise((r) => setTimeout(r, 50));
    emitNotification(alice, { _id: "n1", matchId });
    expect((await received)._id).toBe("n1");
    await new Promise((r) => setTimeout(r, 50));
    expect(malloryGotIt).toBe(false);
  });
});

describe("chat authorization", () => {
  it("non-participants cannot join a chat", async () => {
    const socket = await connect("/chat", signAccessToken(mallory));
    socket.emit("join_chat", matchId);
    const err = await next<{ message: string }>(socket, "error");
    expect(err.message).toMatch(/not part of this match/i);
  });

  it("attributes messages to the authenticated sender and the real counterpart", async () => {
    const a = await connect("/chat", signAccessToken(alice));
    const b = await connect("/chat", signAccessToken(bob));
    const histories = Promise.all([next(a, "chat_history"), next(b, "chat_history")]);
    a.emit("join_chat", matchId);
    b.emit("join_chat", matchId);
    await histories;

    const incoming = next<{ senderId: string; receiverId: string; content: string }>(b, "new_message");
    a.emit("send_message", { matchId, senderId: mallory, receiverId: mallory, content: "  hi bob  " });
    expect(await incoming).toMatchObject({ senderId: alice, receiverId: bob, content: "hi bob" });
  });

  it("rejects empty and oversized messages", async () => {
    const a = await connect("/chat", signAccessToken(alice));
    const history = next(a, "chat_history");
    a.emit("join_chat", matchId);
    await history;
    for (const content of ["   ", "x".repeat(2001)]) {
      const err = next<{ message: string }>(a, "error");
      a.emit("send_message", { matchId, content });
      expect((await err).message).toMatch(/message/i);
    }
  });

  it("cannot send into a chat without joining it", async () => {
    const socket = await connect("/chat", signAccessToken(mallory));
    const err = next<{ message: string }>(socket, "error");
    socket.emit("send_message", { matchId, content: "spam" });
    expect((await err).message).toMatch(/not part of this match/i);
  });
});
