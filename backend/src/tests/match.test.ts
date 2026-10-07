/** @format */

import request from "supertest";
import mongoose from "mongoose";
import initApp from "../server";
import { Express } from "express";
import userModel from "../models/user_model";
import itemModel from "../models/item_model";
import matchModel from "../models/match_model";
import notificationModel from "../models/notification_model";
import {
  itemFields,
  listUploadedItemFiles,
  postItem,
  removeNewUploadedItemFiles,
} from "./test_utils";

import { queue } from "../jobs";
import { fakeAi } from "./setup/fake-ai";

// Gemini is replaced by a deterministic fake so the tests are offline.
jest.mock("../matching/ai-client", () => ({
  ...jest.requireActual("../matching/ai-client"),
  createAiClient: () => jest.requireActual("./setup/fake-ai").fakeAi,
}));

type TestUser = {
  email: string;
  userName: string;
  password: string;
  phoneNumber: string;
  _id?: string;
  accessToken?: string;
};

const owner: TestUser = {
  email: "owner@match.test",
  userName: "matchOwner",
  password: "password123",
  phoneNumber: "+972500000001",
};
const finder: TestUser = {
  email: "finder@match.test",
  userName: "matchFinder",
  password: "password123",
  phoneNumber: "+972500000002",
};

// Unique category so items from other test files can never be compared/matched.
const category = "MatchTestCategory";

let app: Express;
let filesBefore: string[];

const cleanup = async () => {
  const users = await userModel.find({ email: /@match\.test$/ });
  const ids = users.map((u) => u._id.toString());
  await notificationModel.deleteMany({ userId: { $in: ids } });
  await matchModel.deleteMany({
    $or: [{ userId1: { $in: ids } }, { userId2: { $in: ids } }],
  });
  await itemModel.deleteMany({ userId: { $in: ids } });
  await userModel.deleteMany({ email: /@match\.test$/ });
};

const registerAndLogin = async (user: TestUser) => {
  const reg = await request(app).post("/auth/register").send(user);
  expect(reg.statusCode).toBe(200);
  const login = await request(app)
    .post("/auth/login")
    .send({ email: user.email, password: user.password });
  expect(login.statusCode).toBe(200);
  user._id = login.body._id;
  user.accessToken = login.body.accessToken;
};

const auth = (user: TestUser) => ({
  Authorization: "Bearer " + user.accessToken,
});

const createItem = async (
  user: TestUser,
  itemType: "lost" | "found",
  description: string
): Promise<string> => {
  const res = await postItem(
    app,
    user.accessToken,
    itemFields({
      category,
      itemType,
      description,
      // found items are reported after the lost date, nearby
      date:
        itemType === "lost"
          ? "2026-01-01T10:00:00.000Z"
          : "2026-01-02T10:00:00.000Z",
      location:
        itemType === "lost"
          ? { lat: 32.0853, lng: 34.7818 }
          : { lat: 32.0863, lng: 34.7828 },
    })
  );
  expect(res.statusCode).toBe(201);
  await queue.drain(); // run the background matching jobs
  const saved = await itemModel.findOne({ userId: user._id, description });
  expect(saved).not.toBeNull();
  return saved!._id.toString();
};

let lostItemId: string;
let foundItemId: string;
let matchId: string;
let ownerNotificationId: string;

beforeAll(async () => {
  app = await initApp();
  filesBefore = listUploadedItemFiles();
  await cleanup();

  // The fake AI reports a confident match for every plausible pair.
  fakeAi.verdict = { ...fakeAi.verdict, score: 90 };

  await registerAndLogin(owner);
  await registerAndLogin(finder);
});

afterAll(async () => {
  await cleanup();
  removeNewUploadedItemFiles(filesBefore);
  await mongoose.connection.close();
});

describe("Match creation via item upload", () => {
  test("Lost item alone creates no match", async () => {
    lostItemId = await createItem(owner, "lost", "Match test lost wallet");
    expect(
      await matchModel.countDocuments({ item1Id: lostItemId })
    ).toBe(0);
  });

  test("Compatible found item creates a match and notifications", async () => {
    foundItemId = await createItem(finder, "found", "Match test found wallet");

    const matches = await matchModel.find({ item1Id: lostItemId });
    expect(matches.length).toBe(1);
    const match = matches[0];
    expect(match.item2Id).toBe(foundItemId);
    expect(match.userId1).toBe(owner._id);
    expect(match.userId2).toBe(finder._id);
    expect(match.matchScore).toBe(90);
    matchId = match._id.toString();

    expect(
      await notificationModel.countDocuments({ matchId: matchId })
    ).toBe(2);
  });
});

describe("Match API Tests", () => {
  test("Get matches requires authentication", async () => {
    const res = await request(app).get(`/match/user/${owner._id}`);
    expect(res.statusCode).toBe(401);
  });

  test("Get matches of a user", async () => {
    const res = await request(app)
      .get(`/match/user/${owner._id}`)
      .set(auth(owner));
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0]._id).toBe(matchId);
  });

  test("Get match by ID", async () => {
    const res = await request(app).get(`/match/${matchId}`).set(auth(owner));
    expect(res.statusCode).toBe(200);
    expect(res.body._id).toBe(matchId);
    expect(res.body.user1Confirmed).toBe(false);
    expect(res.body.user2Confirmed).toBe(false);
  });

  test("Get match by non-existent ID returns 404", async () => {
    const res = await request(app)
      .get(`/match/${new mongoose.Types.ObjectId()}`)
      .set(auth(owner));
    expect(res.statusCode).toBe(404);
    expect(res.body.message).toBe("Match not found");
  });
});

describe("Notification API Tests", () => {
  test("Get notifications requires authentication", async () => {
    const res = await request(app).get(`/notification?userId=${owner._id}`);
    expect(res.statusCode).toBe(401);
  });

  test("Get notifications ignores a userId in the query", async () => {
    const res = await request(app).get(`/notification?userId=${finder._id}`).set(auth(owner));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.every((n: { userId: string }) => n.userId === owner._id)).toBe(true);
  });

  test("Get notifications of a user", async () => {
    const res = await request(app)
      .get(`/notification?userId=${owner._id}`)
      .set(auth(owner));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.length).toBe(1);
    const notification = res.body.data[0];
    expect(notification.type).toBe("MATCH_FOUND");
    expect(notification.matchId).toBe(matchId);
    expect(notification.isRead).toBe(false);
    ownerNotificationId = notification._id;
  });

  test("Get notification by ID", async () => {
    const res = await request(app)
      .get(`/notification/${ownerNotificationId}`)
      .set(auth(owner));
    expect(res.statusCode).toBe(200);
    expect(res.body.data._id).toBe(ownerNotificationId);
  });

  test("Get notification by non-existent ID returns 404", async () => {
    const res = await request(app)
      .get(`/notification/${new mongoose.Types.ObjectId()}`)
      .set(auth(owner));
    expect(res.statusCode).toBe(404);
  });

  test("Mark notification as read", async () => {
    const res = await request(app)
      .put(`/notification/${ownerNotificationId}/read`)
      .set(auth(owner));
    expect(res.statusCode).toBe(200);
    expect(res.body.data.isRead).toBe(true);
  });

  test("Mark all notifications as read", async () => {
    const res = await request(app)
      .put("/notification/read-all")
      .set(auth(finder))
      .send({ userId: finder._id });
    expect(res.statusCode).toBe(200);
    expect(res.body.modifiedCount).toBe(1);

    const unread = await notificationModel.countDocuments({
      userId: finder._id,
      isRead: false,
    });
    expect(unread).toBe(0);
  });

  test("Mark all as read only touches my notifications", async () => {
    const res = await request(app).put("/notification/read-all").set(auth(finder)).send({ userId: owner._id });
    expect(res.statusCode).toBe(200);
    expect(res.body.modifiedCount).toBe(0);
  });

  test("Delete notification", async () => {
    const res = await request(app)
      .delete(`/notification/${ownerNotificationId}`)
      .set(auth(owner));
    expect(res.statusCode).toBe(200);

    const res2 = await request(app)
      .get(`/notification/${ownerNotificationId}`)
      .set(auth(owner));
    expect(res2.statusCode).toBe(404);
  });
});

describe("Match confirmation", () => {
  test("Confirm requires authentication", async () => {
    const res = await request(app)
      .post("/match/confirm")
      .send({ matchId, userId: owner._id });
    expect(res.statusCode).toBe(401);
  });

  test("Confirm without a matchId returns 400", async () => {
    const res = await request(app).post("/match/confirm").set(auth(owner)).send({});
    expect(res.statusCode).toBe(400);
  });

  test("Confirm by a user not part of the match returns 403", async () => {
    const stranger = { ...owner, email: "stranger@match.test", userName: "matchStranger" };
    await registerAndLogin(stranger);
    // the body names the owner, but identity comes from the stranger's token
    const res = await request(app).post("/match/confirm").set(auth(stranger)).send({ matchId, userId: owner._id });
    expect(res.statusCode).toBe(403);
  });

  test("First user confirms: partially confirmed", async () => {
    const res = await request(app)
      .post("/match/confirm")
      .set(auth(owner))
      .send({ matchId, userId: owner._id });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("PARTIALLY_CONFIRMED");
    expect(res.body.match.user1Confirmed).toBe(true);
    expect(res.body.awaitingConfirmation).toBe("user2");
  });

  test("Confirming twice returns 400", async () => {
    const res = await request(app)
      .post("/match/confirm")
      .set(auth(owner))
      .send({ matchId, userId: owner._id });
    expect(res.statusCode).toBe(400);
  });

  test("Second user confirms: match completed and items resolved", async () => {
    const res = await request(app)
      .post("/match/confirm")
      .set(auth(finder))
      .send({ matchId, userId: finder._id });
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe("FULLY_CONFIRMED");

    const lost = await request(app).get(`/items/${lostItemId}`);
    const found = await request(app).get(`/items/${foundItemId}`);
    expect(lost.body.isResolved).toBe(true);
    expect(found.body.isResolved).toBe(true);

    // The confirmed match (and its chat) is kept; both owners can now see each other's contact details.
    const getMatch = await request(app).get(`/match/${matchId}`).set(auth(owner));
    expect(getMatch.statusCode).toBe(200);
    expect(getMatch.body.confirmedAt).toBeDefined();
    expect(await notificationModel.countDocuments({ matchId })).toBe(0);
    const finderProfile = await request(app).get(`/auth/${finder._id}`).set(auth(owner));
    expect(finderProfile.body.phoneNumber).toBe(finder.phoneNumber);
  });
});

describe("Match deletion", () => {
  let lost2Id: string;

  test("Delete match removes it and its notifications", async () => {
    lost2Id = await createItem(owner, "lost", "Match test lost phone");
    await createItem(finder, "found", "Match test found phone");
    const match = await matchModel.findOne({ item1Id: lost2Id });
    expect(match).not.toBeNull();
    const id = match!._id.toString();

    const unauth = await request(app).delete(`/match/${id}`);
    expect(unauth.statusCode).toBe(401);

    const res = await request(app).delete(`/match/${id}`).set(auth(owner));
    expect(res.statusCode).toBe(200);
    expect(await matchModel.findById(id)).toBeNull();
    expect(await notificationModel.countDocuments({ matchId: id })).toBe(0);

    const again = await request(app).delete(`/match/${id}`).set(auth(owner));
    expect(again.statusCode).toBe(404);
  });

  test("Deleting an item removes its matches and notifications", async () => {
    await createItem(finder, "found", "Match test found phone 2");
    const match = await matchModel.findOne({ item1Id: lost2Id });
    expect(match).not.toBeNull();
    const id = match!._id.toString();
    expect(await notificationModel.countDocuments({ matchId: id })).toBe(2);

    const res = await request(app)
      .delete(`/items/${lost2Id}`)
      .set(auth(owner));
    expect(res.statusCode).toBe(200);
    expect(await matchModel.countDocuments({ item1Id: lost2Id })).toBe(0);
    expect(await notificationModel.countDocuments({ matchId: id })).toBe(0);
  });
});
