import request from "supertest";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Express } from "express";
import initApp from "../server";
import userModel from "../models/user_model";
import { config } from "../lib/config";
import { signRefreshToken } from "../lib/tokens";

// Google sign-in verification is mocked so no request ever reaches Google.
const mockVerifyIdToken = jest.fn();
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  })),
}));

let app: Express;
// Every user created here has an e-mail on this domain, so cleanup never touches other test files' data.
const userEmails = /@auth\.test$/;

const user = {
  email: "testuser@auth.test",
  password: "password123",
  userName: "authTestUser",
  phoneNumber: "+972500000000",
};
let userId: string;
let accessToken: string;
let refreshToken: string;

beforeAll(async () => {
  app = await initApp();
  await userModel.deleteMany({ email: userEmails });
});

afterAll(async () => {
  await userModel.deleteMany({ email: userEmails });
  await mongoose.connection.close();
});

describe("registration", () => {
  it("creates a user without exposing credentials", async () => {
    const res = await request(app).post("/auth/register").send(user);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
    expect(res.body.password).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
    userId = res.body._id;
  });

  it("normalizes the email to lower case", async () => {
    const res = await request(app)
      .post("/auth/register")
      .send({ ...user, email: "MixedCase@Auth.Test", userName: "mixedCase" });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("mixedcase@auth.test");
  });

  it("rejects duplicate user names and emails with 409", async () => {
    const dupName = await request(app).post("/auth/register").send({ ...user, email: "other@auth.test" });
    expect(dupName.status).toBe(409);
    expect(dupName.body.message).toBe("User name already exists");

    const dupEmail = await request(app).post("/auth/register").send({ ...user, userName: "someoneElse" });
    expect(dupEmail.status).toBe(409);
    expect(dupEmail.body.message).toBe("email already exists");
  });

  it("validates the payload", async () => {
    const weak = await request(app).post("/auth/register").send({ ...user, email: "weak@auth.test", userName: "weak", password: "123" });
    expect(weak.status).toBe(400);
    expect(weak.body.error).toBe("VALIDATION_ERROR");

    const noPhone = await request(app).post("/auth/register").send({ email: "nophone@auth.test", password: "password123", userName: "nophone" });
    expect(noPhone.status).toBe(400);
  });
});

describe("login", () => {
  it("returns a token pair", async () => {
    const res = await request(app).post("/auth/login").send({ email: user.email, password: user.password });
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(userId);
    accessToken = res.body.accessToken;
    refreshToken = res.body.refreshToken;
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();
  });

  it("gives the same 401 for a wrong password and an unknown email", async () => {
    const wrongPassword = await request(app).post("/auth/login").send({ email: user.email, password: "wrong-password" });
    const unknownEmail = await request(app).post("/auth/login").send({ email: "nobody@auth.test", password: user.password });
    for (const res of [wrongPassword, unknownEmail]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "INVALID_CREDENTIALS", message: "Email or password incorrect" });
    }
  });

  it("the access token opens protected routes", async () => {
    const res = await request(app).get(`/match/user/${userId}`).set("Authorization", `JWT ${accessToken}`);
    expect(res.status).toBe(200);
  });
});

describe("refresh & logout", () => {
  it("rotates the refresh token", async () => {
    const res = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);
    const old = refreshToken;
    refreshToken = res.body.refreshToken;
    accessToken = res.body.accessToken;

    // The rotated-out token is now revoked, and reusing it signs the user out everywhere.
    const reuse = await request(app).post("/auth/refresh").send({ refreshToken: old });
    expect(reuse.status).toBe(401);
    const afterReuse = await request(app).post("/auth/refresh").send({ refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it("rejects invalid, missing and access-type refresh tokens", async () => {
    expect((await request(app).post("/auth/refresh").send({ refreshToken: "garbage" })).status).toBe(401);
    expect((await request(app).post("/auth/refresh").send({})).status).toBe(400);
    expect((await request(app).post("/auth/refresh").send({ refreshToken: accessToken })).status).toBe(401);
    const forged = jwt.sign({ _id: userId, typ: "refresh" }, "another-secret-another-secret-123456");
    expect((await request(app).post("/auth/refresh").send({ refreshToken: forged })).status).toBe(401);
  });

  it("returns 404 for a valid token of a deleted user", async () => {
    const ghost = signRefreshToken(new mongoose.Types.ObjectId().toString());
    expect((await request(app).post("/auth/refresh").send({ refreshToken: ghost })).status).toBe(404);
  });

  it("logs out a session", async () => {
    const login = await request(app).post("/auth/login").send({ email: user.email, password: user.password });
    accessToken = login.body.accessToken;
    const res = await request(app).post("/auth/logout").send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(200);
    const again = await request(app).post("/auth/refresh").send({ refreshToken: login.body.refreshToken });
    expect(again.status).toBe(401);
  });
});

describe("protected routes", () => {
  it("reject requests without a valid access token", async () => {
    const missing = await request(app).get("/notification");
    expect(missing.status).toBe(401);
    expect((await request(app).get("/notification").set("Authorization", "Basic abc")).status).toBe(401);
    expect((await request(app).get("/notification").set("Authorization", "Bearer garbage")).status).toBe(401);
    const expired = jwt.sign({ _id: userId, typ: "access" }, config.TOKEN_SECRET, { expiresIn: -1 });
    const res = await request(app).get("/notification").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("TOKEN_EXPIRED");
  });
});

describe("profile", () => {
  it("returns my own profile with contact details", async () => {
    const res = await request(app).get(`/auth/${userId}`).set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(user.email);
    expect(res.body.phoneNumber).toBe(user.phoneNumber);
    expect(res.body.password).toBeUndefined();
  });

  it("returns 404 for unknown ids and 400 for malformed ids", async () => {
    expect((await request(app).get(`/auth/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
    expect((await request(app).get("/auth/not-an-id")).status).toBe(400);
  });

  it("updates my user name and password", async () => {
    const res = await request(app)
      .put(`/auth/${userId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ userName: "renamedUser", password: "newPassword123" });
    expect(res.status).toBe(200);
    expect(res.body.userName).toBe("renamedUser");
    const login = await request(app).post("/auth/login").send({ email: user.email, password: "newPassword123" });
    expect(login.status).toBe(200);
  });

  it("refuses a user name that is taken", async () => {
    const res = await request(app)
      .put(`/auth/${userId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ userName: "mixedCase" });
    expect(res.status).toBe(409);
  });

  it("deletes my account", async () => {
    const res = await request(app).delete(`/auth/${userId}`).set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(await userModel.exists({ _id: userId })).toBeNull();
  });
});

describe("google sign-in", () => {
  it("rejects an invalid credential", async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error("Wrong number of segments"));
    const res = await request(app).post("/auth/google").send({ credential: "invalid_token" });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid Google credential");
  });

  it("rejects a token without an email", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => ({}) });
    const res = await request(app).post("/auth/google").send({ credential: "token_without_email" });
    expect(res.status).toBe(400);
  });

  it("creates the account once and reuses it", async () => {
    const payload = { email: "googleuser@auth.test", name: "Google User", picture: "http://example.com/avatar.png" };
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });

    const first = await request(app).post("/auth/google").send({ credential: "valid_google_token" });
    expect(first.status).toBe(200);
    expect(first.body.email).toBe(payload.email);
    expect(first.body.userName).toBe("Google User");
    expect(first.body.imgUrl).toBe(payload.picture);
    expect(first.body.accessToken).toBeDefined();

    const second = await request(app).post("/auth/google").send({ credential: "valid_google_token" });
    expect(second.body._id).toBe(first.body._id);
    expect(await userModel.countDocuments({ email: payload.email })).toBe(1);

    // a Google account cannot be logged into with any password
    const login = await request(app).post("/auth/login").send({ email: payload.email, password: " " });
    expect(login.status).toBe(401);
  });
});
