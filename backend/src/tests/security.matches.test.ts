import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import initApp from "../server";
import userModel from "../models/user_model";
import matchModel from "../models/match_model";
import notificationModel from "../models/notification_model";

let app: Express;
type Session = { id: string; token: string };

const signUp = async (name: string): Promise<Session> => {
  const email = `${name}@sec-match.test`;
  await request(app).post("/auth/register").send({ email, password: "password123", userName: name, phoneNumber: "1" });
  const res = await request(app).post("/auth/login").send({ email, password: "password123" });
  return { id: res.body._id, token: res.body.accessToken };
};
const bearer = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

let alice: Session, bob: Session, mallory: Session;
let matchId: string;
let notificationId: string;

beforeAll(async () => {
  app = await initApp();
  await userModel.deleteMany({ email: /@sec-match\.test$/ });
  alice = await signUp("secMatchAlice");
  bob = await signUp("secMatchBob");
  mallory = await signUp("secMatchMallory");
  const match = await matchModel.create({ item1Id: "x1", userId1: alice.id, item2Id: "x2", userId2: bob.id, matchScore: 88 });
  matchId = match._id.toString();
  const notification = await notificationModel.create({
    userId: alice.id,
    matchId,
    type: "MATCH_FOUND",
    title: "t",
    message: "m",
  });
  notificationId = notification._id.toString();
});

afterAll(async () => {
  await notificationModel.deleteMany({ matchId });
  await matchModel.deleteMany({ _id: matchId });
  await userModel.deleteMany({ email: /@sec-match\.test$/ });
  await mongoose.connection.close();
});

// Notification checks run first: confirming the match below clears its notifications.
describe("notification authorization", () => {
  it("lists only my notifications, whatever the query string says", async () => {
    const res = await request(app).get(`/notification?userId=${alice.id}`).set(bearer(mallory));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("someone else's notification is reported as not found", async () => {
    expect((await request(app).get(`/notification/${notificationId}`).set(bearer(mallory))).status).toBe(404);
    expect((await request(app).put(`/notification/${notificationId}/read`).set(bearer(mallory))).status).toBe(404);
    expect((await request(app).delete(`/notification/${notificationId}`).set(bearer(mallory))).status).toBe(404);
    const mine = await request(app).get(`/notification/${notificationId}`).set(bearer(alice));
    expect(mine.status).toBe(200);
    expect(mine.body.data.isRead).toBe(false);
  });
});

describe("match authorization", () => {
  it("cannot list another user's matches", async () => {
    expect((await request(app).get(`/match/user/${alice.id}`).set(bearer(mallory))).status).toBe(403);
    expect((await request(app).get(`/match/user/${alice.id}`).set(bearer(alice))).status).toBe(200);
  });

  it("non-participants cannot read, confirm or delete a match", async () => {
    expect((await request(app).get(`/match/${matchId}`).set(bearer(mallory))).status).toBe(403);
    const confirm = await request(app).post("/match/confirm").set(bearer(mallory)).send({ matchId, userId: alice.id });
    expect(confirm.status).toBe(403);
    expect((await request(app).delete(`/match/${matchId}`).set(bearer(mallory))).status).toBe(403);
    // the rejected confirm must not have deleted anyone's notifications
    expect(await notificationModel.countDocuments({ matchId })).toBe(1);
    expect(await matchModel.exists({ _id: matchId })).not.toBeNull();
  });

  it("confirm uses the token identity, not the body", async () => {
    const res = await request(app).post("/match/confirm").set(bearer(bob)).send({ matchId, userId: alice.id });
    expect(res.status).toBe(200);
    expect(res.body.userConfirmed).toBe("user2");
    expect(res.body.match.user1Confirmed).toBe(false);
  });
});
