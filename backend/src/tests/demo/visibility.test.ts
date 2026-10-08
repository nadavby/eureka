import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import initApp from "../../server";
import userModel from "../../models/user_model";
import itemModel from "../../models/item_model";
import { signAccessToken } from "../../lib/tokens";
import { InMemoryCandidateSearch } from "../../matching/candidate-search";

let app: Express;
const category = "VisibilityCategory";
const base = { imageUrl: "http://x/i.png", category, date: new Date("2026-10-01"), location: { lat: 32, lng: 34 }, embedding: [1, 0, 0] };
let visitorA: string, visitorB: string, bot: string;
let publicItem: string, sandboxA: string;

beforeAll(async () => {
  app = await initApp();
  const mk = (userName: string, demoRole?: string) =>
    userModel.create({ email: `${userName}@vis.test`, password: "x", userName, phoneNumber: "1", demoRole });
  visitorA = (await mk("visA", "visitor"))._id.toString();
  visitorB = (await mk("visB", "visitor"))._id.toString();
  bot = (await mk("visBot", "seed"))._id.toString();
  publicItem = (await itemModel.create({ ...base, userId: bot, itemType: "found" }))._id.toString();
  sandboxA = (await itemModel.create({ ...base, userId: visitorA, itemType: "lost", sandbox: true, sandboxOwnerId: visitorA }))._id.toString();
});

afterAll(async () => {
  await itemModel.deleteMany({ category });
  await userModel.deleteMany({ email: /@vis\.test$/ });
  await mongoose.connection.close();
});

const ids = (res: request.Response) => res.body.map((i: { _id: string }) => i._id);

describe("sandbox visibility", () => {
  it("anonymous visitors and other visitors never see a sandbox item in listings", async () => {
    for (const req of [request(app).get("/items"), request(app).get("/items").set("Authorization", `Bearer ${signAccessToken(visitorB)}`)]) {
      const res = await req;
      expect(ids(res)).toContain(publicItem);
      expect(ids(res)).not.toContain(sandboxA);
    }
  });

  it("the owner sees their own sandbox items", async () => {
    const res = await request(app).get(`/items?userId=${visitorA}`).set("Authorization", `Bearer ${signAccessToken(visitorA)}`);
    expect(ids(res)).toContain(sandboxA);
  });

  it("a sandbox item page is 404 for everyone but its owner", async () => {
    expect((await request(app).get(`/items/${sandboxA}`)).status).toBe(404);
    expect((await request(app).get(`/items/${sandboxA}`).set("Authorization", `Bearer ${signAccessToken(visitorB)}`)).status).toBe(404);
    expect((await request(app).get(`/items/${sandboxA}`).set("Authorization", `Bearer ${signAccessToken(visitorA)}`)).status).toBe(200);
  });

  it("sandbox items are never matching candidates", async () => {
    const results = await new InMemoryCandidateSearch().find({ _id: publicItem, itemType: "found", category, embedding: [1, 0, 0] }, 10);
    expect(results.map((r) => r.item._id)).not.toContain(sandboxA);
  });
});
