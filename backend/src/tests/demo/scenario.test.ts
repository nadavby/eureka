import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import initApp from "../../server";
import userModel from "../../models/user_model";
import itemModel from "../../models/item_model";
import matchModel from "../../models/match_model";
import chatModel from "../../models/chat_model";
import notificationModel from "../../models/notification_model";
import demoTemplateModel from "../../models/demo_template_model";
import { MAX_LIVE_VISITORS } from "../../demo/scenario";

let app: Express;
let botId: string;

const template = (bot: string) => ({
  botId: bot,
  score: 92,
  reasons: ["Same torn corner"],
  conflicts: ["Different lighting"],
  firstMessage: "Hi! I think I found your wallet.",
  botReply: "It has a receipt from a bookshop.",
  lost: {
    imageUrl: "http://img/lost.webp",
    category: "wallet",
    description: "Brown leather wallet",
    colors: ["brown"],
    date: new Date("2026-10-03"),
    location: { lat: 32.06, lng: 34.77 },
    placeName: "Rothschild Blvd, Tel Aviv",
  },
  found: {
    imageUrl: "http://img/found.webp",
    category: "wallet",
    description: "Wallet found on a bench",
    colors: ["brown"],
    date: new Date("2026-10-04"),
    location: { lat: 32.07, lng: 34.78 },
    placeName: "Habima Square, Tel Aviv",
  },
});

beforeAll(async () => {
  app = await initApp();
  await demoTemplateModel.deleteMany({});
  const bot = await userModel.create({ email: "noam@scenario.test", password: "x", userName: "Noam", phoneNumber: "+972500000001", demoRole: "seed" });
  botId = bot._id.toString();
});

afterAll(async () => {
  const visitors = await userModel.find({ demoRole: "visitor" });
  const ids = [botId, ...visitors.map((v) => v._id.toString())];
  await itemModel.deleteMany({ userId: { $in: ids } });
  await matchModel.deleteMany({ $or: [{ userId1: { $in: ids } }, { userId2: { $in: ids } }] });
  await chatModel.deleteMany({ senderId: { $in: ids } });
  await notificationModel.deleteMany({ userId: { $in: ids } });
  await userModel.deleteMany({ _id: { $in: ids } });
  await demoTemplateModel.deleteMany({});
  await mongoose.connection.close();
});

describe("POST /auth/demo", () => {
  it("answers 503 until the demo has been seeded", async () => {
    const res = await request(app).post("/auth/demo");
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("DEMO_UNAVAILABLE");
  });

  it("creates a private visitor with a ready match, a notification and a waiting message", async () => {
    await demoTemplateModel.create(template(botId));
    const res = await request(app).post("/auth/demo");
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    const visitorId: string = res.body._id;

    const visitor = await userModel.findById(visitorId);
    expect(visitor!.demoRole).toBe("visitor");
    expect(visitor!.userName).toMatch(/^Guest \d{4}$/);

    const match = await matchModel.findById(res.body.matchId);
    expect(match).toMatchObject({ userId1: botId, userId2: visitorId, matchScore: 92, reasons: ["Same torn corner"] });

    const [found, lost] = await Promise.all([itemModel.findById(match!.item1Id), itemModel.findById(match!.item2Id)]);
    expect(lost).toMatchObject({ userId: visitorId, itemType: "lost", sandbox: true, sandboxOwnerId: visitorId, matchCount: 1 });
    expect(found).toMatchObject({ userId: botId, itemType: "found", sandbox: true, sandboxOwnerId: visitorId });
    // copies share the template image, so deleting them must never delete the image
    expect(lost!.imagePublicId).toBeUndefined();

    expect(await notificationModel.countDocuments({ userId: visitorId, matchId: res.body.matchId })).toBe(1);
    const chat = await chatModel.find({ matchId: res.body.matchId });
    expect(chat).toHaveLength(1);
    expect(chat[0]).toMatchObject({ senderId: botId, receiverId: visitorId, content: "Hi! I think I found your wallet." });

    // the visitor can open their own scenario items
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    expect((await request(app).get(`/items/${found!._id}`).set(auth)).status).toBe(200);
  });

  it("gives every visitor their own sandbox", async () => {
    const a = await request(app).post("/auth/demo");
    const b = await request(app).post("/auth/demo");
    expect(a.body._id).not.toBe(b.body._id);
    expect(a.body.matchId).not.toBe(b.body.matchId);
    const asB = await request(app).get(`/match/${a.body.matchId}`).set("Authorization", `Bearer ${b.body.accessToken}`);
    expect(asB.status).toBe(403);
  });

  it("visitors cannot edit or delete their account", async () => {
    const res = await request(app).post("/auth/demo");
    const auth = { Authorization: `Bearer ${res.body.accessToken}` };
    const put = await request(app).put(`/auth/${res.body._id}`).set(auth).send({ userName: "Hacker" });
    expect(put.status).toBe(403);
    expect(put.body.error).toBe("DEMO_READONLY");
    expect((await request(app).delete(`/auth/${res.body._id}`).set(auth)).body.error).toBe("DEMO_READONLY");
  });

  it("refuses new visitors when the live cap is reached", async () => {
    const live = await userModel.countDocuments({ demoRole: "visitor" });
    await userModel.insertMany(
      Array.from({ length: MAX_LIVE_VISITORS - live }, (_, i) => ({
        email: `filler-${i}@scenario.test`,
        password: "x",
        userName: "filler",
        phoneNumber: "1",
        demoRole: "visitor",
      }))
    );
    const res = await request(app).post("/auth/demo");
    expect(res.status).toBe(503);
    expect(res.body.error).toBe("DEMO_BUSY");
  });
});
