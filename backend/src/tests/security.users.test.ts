import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import initApp from "../server";
import userModel from "../models/user_model";
import matchModel from "../models/match_model";

let app: Express;
type Session = { id: string; token: string };

const signUp = async (name: string): Promise<Session> => {
  const email = `${name}@sec-users.test`;
  await request(app).post("/auth/register").send({ email, password: "password123", userName: name, phoneNumber: "+972500000000" });
  const res = await request(app).post("/auth/login").send({ email, password: "password123" });
  return { id: res.body._id, token: res.body.accessToken };
};
const bearer = (s: Session) => ({ Authorization: `Bearer ${s.token}` });

let alice: Session, bob: Session, carol: Session;

beforeAll(async () => {
  app = await initApp();
  await userModel.deleteMany({ email: /@sec-users\.test$/ });
  alice = await signUp("alice");
  bob = await signUp("bob");
  carol = await signUp("carol");
  // alice and bob share a match; carol is a stranger to both
  await matchModel.create({ item1Id: "i1", userId1: alice.id, item2Id: "i2", userId2: bob.id, matchScore: 90 });
});

afterAll(async () => {
  await matchModel.deleteMany({ userId1: alice.id });
  await userModel.deleteMany({ email: /@sec-users\.test$/ });
  await mongoose.connection.close();
});

describe("user privacy", () => {
  it("the user list endpoint no longer exists", async () => {
    expect((await request(app).get("/auth")).status).toBe(404);
  });

  it("strangers and anonymous visitors see only the public profile", async () => {
    for (const req of [request(app).get(`/auth/${alice.id}`).set(bearer(carol)), request(app).get(`/auth/${alice.id}`)]) {
      const res = await req;
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(expect.arrayContaining(["_id", "userName"]));
      expect(res.body.email).toBeUndefined();
      expect(res.body.phoneNumber).toBeUndefined();
      expect(res.body.password).toBeUndefined();
    }
  });

  it("an unconfirmed match does not reveal contact details yet", async () => {
    const res = await request(app).get(`/auth/${alice.id}`).set(bearer(bob));
    expect(res.body.email).toBeUndefined();
    expect(res.body.phoneNumber).toBeUndefined();
  });

  it("a confirmed match shares contact details", async () => {
    await matchModel.updateOne({ userId1: alice.id, userId2: bob.id }, { confirmedAt: new Date(), user1Confirmed: true, user2Confirmed: true });
    const res = await request(app).get(`/auth/${alice.id}`).set(bearer(bob));
    expect(res.body.email).toBe("alice@sec-users.test");
    expect(res.body.phoneNumber).toBe("+972500000000");
    expect(res.body.password).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });
});

describe("profile writes are self-only", () => {
  it("requires authentication", async () => {
    expect((await request(app).put(`/auth/${alice.id}`).send({ userName: "x" })).status).toBe(401);
    expect((await request(app).delete(`/auth/${alice.id}`)).status).toBe(401);
  });

  it("forbids editing or deleting someone else", async () => {
    expect((await request(app).put(`/auth/${alice.id}`).set(bearer(carol)).send({ userName: "hacked" })).status).toBe(403);
    expect((await request(app).delete(`/auth/${alice.id}`).set(bearer(carol))).status).toBe(403);
    expect(await userModel.exists({ _id: alice.id, userName: "alice" })).not.toBeNull();
  });

  it("rejects fields that are not editable", async () => {
    for (const body of [{ refreshToken: ["x"] }, { email: "new@sec-users.test" }, { _id: carol.id }]) {
      const res = await request(app).put(`/auth/${alice.id}`).set(bearer(alice)).send(body);
      expect(res.status).toBe(400);
    }
  });
});
