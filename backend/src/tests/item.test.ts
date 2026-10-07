/** @format */

import request from "supertest";
import mongoose from "mongoose";
import initApp from "../server";
import { Express } from "express";
import userModel from "../models/user_model";
import itemModel from "../models/item_model";
import matchModel from "../models/match_model";
import notificationModel from "../models/notification_model";
import visionService from "../services/vision-service";
import geminiService from "../services/gemini-service";
import {
  itemFields,
  listUploadedItemFiles,
  postItem,
  removeNewUploadedItemFiles,
} from "./test_utils";

// External Google APIs are mocked so the tests are deterministic and offline.
jest.mock("../services/vision-service", () => ({
  __esModule: true,
  default: { getImageAnalysis: jest.fn() },
}));
jest.mock("../services/gemini-service", () => ({
  __esModule: true,
  default: { evaluateMatch: jest.fn() },
}));

const mockedVision = visionService.getImageAnalysis as jest.Mock;
const mockedGemini = geminiService.evaluateMatch as jest.Mock;

let app: Express;
let accessToken: string;
let userId: string;
let lostItemId: string;
let foundItemId: string;
let filesBefore: string[];

const testEmail = "itemtest@item.test";
// Unique category so items from other test files can never be compared/matched.
const category = "ItemTestCategory";

const cleanup = async () => {
  const users = await userModel.find({ email: /@item\.test$/ });
  const ids = users.map((u) => u._id.toString());
  await notificationModel.deleteMany({ userId: { $in: ids } });
  await matchModel.deleteMany({
    $or: [{ userId1: { $in: ids } }, { userId2: { $in: ids } }],
  });
  await itemModel.deleteMany({ userId: { $in: ids } });
  await userModel.deleteMany({ email: /@item\.test$/ });
};

beforeAll(async () => {
  app = await initApp();
  filesBefore = listUploadedItemFiles();
  await cleanup();

  mockedVision.mockResolvedValue({
    labels: ["Wallet", "Leather"],
    objects: [{ name: "Wallet", score: 0.9 }],
    texts: [],
    logos: [],
  });
  // Low score: no AI match should be created inside this file.
  mockedGemini.mockResolvedValue({ confidenceScore: 10, reasoning: "mock" });

  const res = await request(app).post("/auth/register").send({
    email: testEmail,
    password: "1234567890",
    userName: "itemTestUser",
    phoneNumber: "+972500000000",
  });
  expect(res.statusCode).toBe(200);

  const loginRes = await request(app).post("/auth/login").send({
    email: testEmail,
    password: "1234567890",
  });
  expect(loginRes.statusCode).toBe(200);
  accessToken = loginRes.body.accessToken;
  userId = loginRes.body._id;
});

afterAll(async () => {
  await cleanup();
  removeNewUploadedItemFiles(filesBefore);
  await mongoose.connection.close();
});

describe("Item API Tests", () => {
  test("Create item requires authentication", async () => {
    // No image attached: the middleware rejects before reading the body, and an
    // unread file stream could make the client see ECONNRESET instead of the 401.
    const res = await postItem(app, undefined, itemFields({ category }), false);
    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("UNAUTHORIZED");
  });

  test("Create item without image fails", async () => {
    const res = await postItem(app, accessToken, itemFields({ category }), false);
    expect(res.statusCode).toBe(400);
    expect(res.text).toContain("Missing required file");
  });

  test("Create item without itemType fails", async () => {
    const res = await postItem(
      app,
      accessToken,
      itemFields({ category, itemType: undefined })
    );
    expect(res.statusCode).toBe(400);
    expect(res.text).toBe("Missing required field: itemType");
  });

  test("Create item with invalid itemType fails", async () => {
    const res = await postItem(
      app,
      accessToken,
      itemFields({ category, itemType: "stolen" })
    );
    expect(res.statusCode).toBe(400);
    expect(res.text).toBe("Item type must be 'lost' or 'found'");
  });

  test("Should create a lost item", async () => {
    const res = await postItem(
      app,
      accessToken,
      itemFields({ category, description: "Test lost item" })
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.itemType).toBe("lost");
    expect(res.body.description).toBe("Test lost item");
    expect(res.body.userId).toBe(userId);
    expect(res.body.ownerName).toBe("itemTestUser");
    expect(res.body.ownerEmail).toBe(testEmail);
    expect(res.body.isResolved).toBe(false);
    expect(res.body.location).toEqual({ lat: 32.0853, lng: 34.7818 });
    expect(res.body.imageUrl).toMatch(/\/public\/items\/\d+\.png$/);
    expect(res.body.visionApiData.labels).toEqual(["Wallet", "Leather"]);
    expect(mockedVision).toHaveBeenCalledWith(res.body.imageUrl);

    const saved = await itemModel.findOne({
      userId,
      description: "Test lost item",
    });
    expect(saved).not.toBeNull();
    lostItemId = saved!._id.toString();
  });

  test("Should create a found item (itemType via 'kind', case-insensitive)", async () => {
    const res = await postItem(
      app,
      accessToken,
      itemFields({
        category,
        itemType: undefined,
        kind: "Found",
        description: "Test found item",
        date: "2026-01-02T10:00:00.000Z",
      })
    );

    expect(res.statusCode).toBe(201);
    expect(res.body.itemType).toBe("found");
    expect(res.body.description).toBe("Test found item");

    // The lost item was evaluated by the (mocked) AI matcher, but with a low score.
    expect(mockedGemini).toHaveBeenCalled();
    expect(await matchModel.countDocuments({ userId1: userId })).toBe(0);

    const saved = await itemModel.findOne({
      userId,
      description: "Test found item",
    });
    expect(saved).not.toBeNull();
    foundItemId = saved!._id.toString();
  });

  test("Should get all items", async () => {
    const res = await request(app).get("/items");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const ids = res.body.map((i: { _id: string }) => i._id);
    expect(ids).toEqual(expect.arrayContaining([lostItemId, foundItemId]));
  });

  test("Should get all lost items", async () => {
    const res = await request(app).get("/items?itemType=lost");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    for (const item of res.body) {
      expect(item.itemType).toBe("lost");
    }
    const ids = res.body.map((i: { _id: string }) => i._id);
    expect(ids).toContain(lostItemId);
    expect(ids).not.toContain(foundItemId);
  });

  test("Should get items by user ID", async () => {
    const res = await request(app).get(`/items?userId=${userId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(2);
    for (const item of res.body) {
      expect(item.userId).toBe(userId);
    }
  });

  test("Should get found items of a user", async () => {
    const res = await request(app).get(`/items?userId=${userId}&itemType=found`);
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0]._id).toBe(foundItemId);
  });

  test("Should get item by ID", async () => {
    const res = await request(app).get(`/items/${lostItemId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body._id).toBe(lostItemId);
    expect(res.body.description).toBe("Test lost item");
  });

  test("Get item by non-existent ID returns 404", async () => {
    const res = await request(app).get(
      `/items/${new mongoose.Types.ObjectId()}`
    );
    expect(res.statusCode).toBe(404);
    expect(res.text).toBe("Item not found");
  });

  test("Delete item requires authentication", async () => {
    const res = await request(app).delete(`/items/${foundItemId}`);
    expect(res.statusCode).toBe(401);
  });

  test("Delete non-existent item returns 404", async () => {
    const res = await request(app)
      .delete(`/items/${new mongoose.Types.ObjectId()}`)
      .set("Authorization", "Bearer " + accessToken);
    expect(res.statusCode).toBe(404);
    expect(res.text).toBe("Item not found");
  });

  test("Should delete an item", async () => {
    const res = await request(app)
      .delete(`/items/${foundItemId}`)
      .set("Authorization", "Bearer " + accessToken);
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe("Item deleted successfully");

    const getRes = await request(app).get(`/items/${foundItemId}`);
    expect(getRes.statusCode).toBe(404);
  });
});
