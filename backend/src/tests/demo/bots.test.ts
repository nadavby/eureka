import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import initApp from "../../server";
import userModel from "../../models/user_model";
import itemModel from "../../models/item_model";
import matchModel from "../../models/match_model";
import chatModel from "../../models/chat_model";
import demoTemplateModel from "../../models/demo_template_model";
import { botReplyFor } from "../../demo/bots";

let app: Express;
let botId: string;
let publicSeedItem: string;

beforeAll(async () => {
  app = await initApp();
  await demoTemplateModel.deleteMany({});
  const bot = await userModel.create({ email: "bot@bots.test", password: "x", userName: "Noam", phoneNumber: "+972500000001", demoRole: "seed" });
  botId = bot._id.toString();
  publicSeedItem = (
    await itemModel.create({ userId: botId, itemType: "found", imageUrl: "x", category: "keys", date: new Date(), location: { lat: 32, lng: 34 } })
  )._id.toString();
  const side = { imageUrl: "x", category: "wallet", description: "w", colors: [], date: new Date(), location: { lat: 32, lng: 34 }, placeName: "p" };
  await demoTemplateModel.create({ botId, score: 90, reasons: ["r"], conflicts: [], firstMessage: "Opening line", botReply: "The receipt is from a bookshop.", lost: side, found: side });
});

afterAll(async () => {
  const ids = [botId, ...(await userModel.find({ demoRole: "visitor" })).map((v) => v._id.toString())];
  await Promise.all([
    itemModel.deleteMany({ userId: { $in: ids } }),
    matchModel.deleteMany({ $or: [{ userId1: { $in: ids } }, { userId2: { $in: ids } }] }),
    chatModel.deleteMany({ $or: [{ senderId: { $in: ids } }, { receiverId: { $in: ids } }] }),
    demoTemplateModel.deleteMany({}),
  ]);
  await userModel.deleteMany({ _id: { $in: ids } });
  await mongoose.connection.close();
});

const startDemo = async () => {
  const res = await request(app).post("/auth/demo");
  return { id: res.body._id as string, matchId: res.body.matchId as string, auth: { Authorization: `Bearer ${res.body.accessToken}` } };
};

describe("demo bots", () => {
  it("confirm together with the visitor, so the flow reaches the contact details", async () => {
    const v = await startDemo();
    const res = await request(app).post("/match/confirm").set(v.auth).send({ matchId: v.matchId });
    expect(res.body.status).toBe("FULLY_CONFIRMED");
    const bot = await request(app).get(`/auth/${botId}`).set(v.auth);
    expect(bot.body.phoneNumber).toBe("+972500000001");
  });

  it("never resolve the public demo items, only the visitor's", async () => {
    const v = await startDemo();
    const lostId = (await itemModel.findOne({ sandboxOwnerId: v.id, userId: v.id }))!._id.toString();
    const match = await matchModel.create({ item1Id: publicSeedItem, userId1: botId, item2Id: lostId, userId2: v.id, matchScore: 80 });
    await request(app).post("/match/confirm").set(v.auth).send({ matchId: match._id.toString() });
    expect((await itemModel.findById(publicSeedItem))!.isResolved).toBe(false);
    expect((await itemModel.findById(lostId))!.isResolved).toBe(true);
  });

  it("answer the visitor's first message once: the scripted reply in the starter chat", async () => {
    const v = await startDemo();
    await chatModel.create({ matchId: v.matchId, senderId: v.id, receiverId: botId, content: "What's inside?" });
    const reply = await botReplyFor(v.matchId, v.id, botId);
    expect(reply?.content).toBe("The receipt is from a bookshop.");

    await chatModel.create({ matchId: v.matchId, senderId: v.id, receiverId: botId, content: "Thanks!" });
    expect(await botReplyFor(v.matchId, v.id, botId)).toBeNull();
  });

  it("answer with a generic line in other conversations, and never for real users", async () => {
    const v = await startDemo();
    const other = new mongoose.Types.ObjectId().toString();
    await chatModel.create({ matchId: other, senderId: v.id, receiverId: botId, content: "Hello" });
    expect((await botReplyFor(other, v.id, botId))?.content).toMatch(/demo account/);

    const realUser = new mongoose.Types.ObjectId().toString();
    expect(await botReplyFor(other, botId, realUser)).toBeNull();
  });
});
