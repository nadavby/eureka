import request from "supertest";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import os from "os";
import { Express } from "express";
import initApp from "../server";
import userModel from "../models/user_model";
import itemModel from "../models/item_model";
import { itemFields, listUploadedItemFiles, postItem, removeNewUploadedItemFiles } from "./test_utils";

import { fakeAi } from "./setup/fake-ai";

// Gemini is replaced by a deterministic fake so the tests are offline.
jest.mock("../matching/ai-client", () => ({
  ...jest.requireActual("../matching/ai-client"),
  createAiClient: () => jest.requireActual("./setup/fake-ai").fakeAi,
}));

let app: Express;
let filesBefore: string[];
type Session = { id: string; token: string };

const signUp = async (name: string): Promise<Session> => {
  const email = `${name}@sec-items.test`;
  await request(app).post("/auth/register").send({ email, password: "password123", userName: name, phoneNumber: "1" });
  const res = await request(app).post("/auth/login").send({ email, password: "password123" });
  return { id: res.body._id, token: res.body.accessToken };
};

let owner: Session, other: Session;
const category = "SecurityItemsCategory";

beforeAll(async () => {
  app = await initApp();
  filesBefore = listUploadedItemFiles();
  fakeAi.verdict = { ...fakeAi.verdict, score: 0 };
  await userModel.deleteMany({ email: /@sec-items\.test$/ });
  owner = await signUp("itemsOwner");
  other = await signUp("itemsOther");
});

afterAll(async () => {
  await itemModel.deleteMany({ userId: { $in: [owner.id, other.id] } });
  await userModel.deleteMany({ email: /@sec-items\.test$/ });
  removeNewUploadedItemFiles(filesBefore);
  await mongoose.connection.close();
});

const tmpFile = (name: string, content: Buffer | string) => {
  const p = path.join(os.tmpdir(), name);
  fs.writeFileSync(p, content);
  return p;
};

describe("item security", () => {
  it("takes the owner from the token, not from the body", async () => {
    const res = await postItem(app, owner.token, { ...itemFields({ category }), userId: other.id });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(owner.id);
  });

  it("rejects files that are not images", async () => {
    const res = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("itemType", "lost")
      .attach("image", tmpFile("not-an-image.txt", "hello"));
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Only image uploads are allowed");
  });

  it("rejects images over 5 MB", async () => {
    const res = await request(app)
      .post("/items")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("itemType", "lost")
      .attach("image", tmpFile("big.png", Buffer.alloc(6 * 1024 * 1024)), { contentType: "image/png" });
    expect(res.status).toBe(413);
  });

  it("never exposes the owner's email", async () => {
    const list = await request(app).get(`/items?userId=${owner.id}`);
    expect(list.body.length).toBeGreaterThan(0);
    expect(list.body[0].ownerEmail).toBeUndefined();
    const single = await request(app).get(`/items/${list.body[0]._id}`);
    expect(single.body.ownerEmail).toBeUndefined();
  });

  it("only the owner can delete an item", async () => {
    const item = await itemModel.findOne({ userId: owner.id });
    const asOther = await request(app).delete(`/items/${item!._id}`).set("Authorization", `Bearer ${other.token}`);
    expect(asOther.status).toBe(403);
    expect(await itemModel.exists({ _id: item!._id })).not.toBeNull();
    const asOwner = await request(app).delete(`/items/${item!._id}`).set("Authorization", `Bearer ${owner.token}`);
    expect(asOwner.status).toBe(200);
  });

  it("validates the listing query", async () => {
    expect((await request(app).get("/items?itemType=stolen")).status).toBe(400);
    expect((await request(app).get("/items?userId=not-an-id")).status).toBe(400);
  });
});
