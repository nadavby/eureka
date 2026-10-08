/** @format */

import request from "supertest";
import mongoose from "mongoose";
import userModel, { iUser } from "../models/user_model";
import initApp from "../server";
import { Express } from "express";
import jwt from "jsonwebtoken";

// Google sign-in verification is mocked so no request ever reaches Google.
const mockVerifyIdToken = jest.fn();
jest.mock("google-auth-library", () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
  })),
}));

let app: Express;

// Every user created by this file has an e-mail on this domain, so cleanup
// never touches data that belongs to other test files.
const userEmails = /@auth\.test$/;

beforeAll(async () => {
  app = await initApp();
  await userModel.deleteMany({ email: userEmails });
});

afterAll(async () => {
  await userModel.deleteMany({ email: userEmails });
  await mongoose.connection.close();
});

const baseUrl = "/auth";

const testUser = {
  email: "testUser@auth.test",
  password: "123456",
  userName: "authTestUser",
  phoneNumber: "+972500000000",
} as Omit<iUser, "refreshToken"> & {
  accessToken?: string;
  refreshToken?: string;
};

// Any route behind authMiddleware works here; GET /notification is a cheap one.
const protectedRoute = () => "/notification?userId=" + testUser._id;

describe("Auth Tests", () => {
  test("Auth test registration", async () => {
    const response = await request(app).post(baseUrl + "/register").send(testUser);
    expect(response.statusCode).toBe(200);
    expect(response.body.email).toBe(testUser.email);
    expect(response.body.phoneNumber).toBe(testUser.phoneNumber);
    expect(response.body.password).not.toBe(testUser.password);
    testUser._id = response.body._id;
  });

  test("Auth duplicate user name test", async () => {
    const response = await request(app)
      .post(baseUrl + "/register")
      .send({ ...testUser, email: "otherEmail@auth.test" });
    expect(response.statusCode).toBe(400);
    expect(response.text).toBe("User name already exists");
  });

  test("Auth duplicate email test", async () => {
    const response = await request(app)
      .post(baseUrl + "/register")
      .send({ ...testUser, userName: "otherUserName" });
    expect(response.statusCode).toBe(400);
    expect(response.text).toBe("email already exists");
  });

  test("Auth registration without phone number fails", async () => {
    const response = await request(app).post(baseUrl + "/register").send({
      email: "nophone@auth.test",
      password: "123456",
      userName: "noPhoneUser",
    });
    expect(response.statusCode).toBe(400);
    expect(await userModel.findOne({ email: "nophone@auth.test" })).toBeNull();
  });

  test("Auth test login - valid", async () => {
    const response = await request(app)
      .post(baseUrl + "/login")
      .send(testUser);
    expect(response.statusCode).toBe(200);
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(response.body._id).toBe(testUser._id);
    testUser.accessToken = response.body.accessToken;
    testUser.refreshToken = response.body.refreshToken;
  });

  test("Auth test login - invalid password", async () => {
    const response = await request(app)
      .post(baseUrl + "/login")
      .send({ email: testUser.email, password: "wrong password" });
    expect(response.statusCode).toBe(404);
    expect(response.text).toBe("User or password incorrect");
  });

  test("Auth test login - user doesn't exist", async () => {
    const response = await request(app)
      .post(baseUrl + "/login")
      .send({ email: "wronguser@auth.test", password: "123456" });
    expect(response.statusCode).toBe(404);
    expect(response.text).toBe("User or password incorrect");
  });

  test("Auth test login - missing environment variables", async () => {
    const originalEnv = { ...process.env };

    delete process.env.TOKEN_SECRET;
    const response = await request(app)
      .post(baseUrl + "/login")
      .send(testUser);
    expect(response.statusCode).toBe(500);
    expect(response.text).toBe("server error");

    delete process.env.TOKEN_EXPIRATION;
    const response2 = await request(app)
      .post(baseUrl + "/login")
      .send(testUser);
    expect(response2.statusCode).toBe(500);
    expect(response2.text).toBe("server error");

    process.env = originalEnv;
  });

  test("Auth test refresh token valid", async () => {
    const response = await request(app)
      .post(baseUrl + "/refresh")
      .send({ refreshToken: testUser.refreshToken });
    expect(response.statusCode).toBe(200);
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    testUser.accessToken = response.body.accessToken;
    testUser.refreshToken = response.body.refreshToken;
  });

  test("Auth test access protected route with valid token", async () => {
    const response = await request(app)
      .get(protectedRoute())
      .set({ authorization: "JWT " + testUser.accessToken });
    expect(response.statusCode).toBe(200);

    const response2 = await request(app)
      .get(protectedRoute())
      .set({ authorization: "Bearer " + testUser.accessToken });
    expect(response2.statusCode).toBe(200);
  });

  test("Auth test middleware with missing authorization header", async () => {
    const response = await request(app).get(protectedRoute());
    expect(response.statusCode).toBe(401);
    expect(response.text).toBe("Unauthorized - Missing authorization header");
  });

  test("Auth test middleware with invalid token format", async () => {
    const response = await request(app)
      .get(protectedRoute())
      .set({ authorization: "Invalid" });
    expect(response.statusCode).toBe(401);
    expect(response.text).toMatch(/^Unauthorized - Invalid authorization format/);
  });

  test("Auth test middleware with invalid token prefix", async () => {
    const response = await request(app)
      .get(protectedRoute())
      .set({ authorization: "Basic " + testUser.accessToken });
    expect(response.statusCode).toBe(401);
    expect(response.text).toMatch(/^Unauthorized - Invalid token prefix/);
  });

  test("Auth test middleware with invalid token", async () => {
    const response = await request(app)
      .get(protectedRoute())
      .set({ authorization: "JWT invalidtoken" });
    expect(response.statusCode).toBe(401);
    expect(response.text).toBe("Unauthorized - Invalid token");
  });

  test("Auth test middleware with token signed by another secret", async () => {
    const token = jwt.sign({ _id: testUser._id }, "some-other-secret");
    const response = await request(app)
      .get(protectedRoute())
      .set({ authorization: "JWT " + token });
    expect(response.statusCode).toBe(401);
  });

  test("Auth test refresh token not valid", async () => {
    const response = await request(app)
      .post(baseUrl + "/refresh")
      .send({ refreshToken: "invalid token" });
    expect(response.statusCode).toBe(401);
    expect(response.text).toBe("Unauthorized");
  });

  test("Auth test refresh token missing", async () => {
    const response = await request(app)
      .post(baseUrl + "/refresh")
      .send({});
    expect(response.statusCode).toBe(400);
    expect(response.text).toBe("refreshToken is required");
  });

  test("Auth test refresh token missing env var", async () => {
    const tokenSecret = process.env.TOKEN_SECRET;
    delete process.env.TOKEN_SECRET;
    const response = await request(app)
      .post(baseUrl + "/refresh")
      .send({ refreshToken: testUser.refreshToken });
    expect(response.statusCode).toBe(500);
    expect(response.text).toBe("server error");
    process.env.TOKEN_SECRET = tokenSecret;
  });

  test("Auth test refresh token user not found", async () => {
    const payload = { _id: new mongoose.Types.ObjectId(), random: 1 };
    const refreshToken = jwt.sign(
      payload,
      process.env.TOKEN_SECRET as string,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION }
    );
    const response = await request(app)
      .post(baseUrl + "/refresh")
      .send({ refreshToken });
    expect(response.statusCode).toBe(404);
    expect(response.text).toBe("User not found");
  });

  test("Auth test refresh token valid but not found in user refreshToken array", async () => {
    const payload = { _id: testUser._id, random: 1 };
    const refreshToken = jwt.sign(
      payload,
      process.env.TOKEN_SECRET as string,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION }
    );
    const response = await request(app)
      .post(baseUrl + "/refresh")
      .send({ refreshToken });
    expect(response.statusCode).toBe(402);
    expect(response.text).toBe("Unauthorized");

    // Token reuse detection: all of the user's refresh tokens are revoked.
    const user = await userModel.findById(testUser._id);
    expect(user?.refreshToken).toEqual([]);
    const response2 = await request(app)
      .post(baseUrl + "/refresh")
      .send({ refreshToken: testUser.refreshToken });
    expect(response2.statusCode).toBe(402);
  });

  test("Auth test logout valid", async () => {
    const login = await request(app).post(baseUrl + "/login").send(testUser);
    expect(login.statusCode).toBe(200);
    testUser.accessToken = login.body.accessToken;
    testUser.refreshToken = login.body.refreshToken;

    const response = await request(app)
      .post(baseUrl + "/logout")
      .send({ refreshToken: testUser.refreshToken });
    expect(response.statusCode).toBe(200);
    expect(response.text).toBe("Logged out");

    // A logged-out refresh token can no longer be used
    const response2 = await request(app)
      .post(baseUrl + "/refresh")
      .send({ refreshToken: testUser.refreshToken });
    expect(response2.statusCode).not.toBe(200);
  });

  test("Auth test logout with invalid token", async () => {
    const response = await request(app)
      .post(baseUrl + "/logout")
      .send({ refreshToken: "invalid token" });
    expect(response.statusCode).toBe(401);
    expect(response.text).toBe("Unauthorized");
  });

  test("Auth test logout with missing token", async () => {
    const response = await request(app)
      .post(baseUrl + "/logout")
      .send({});
    expect(response.statusCode).toBe(400);
    expect(response.text).toBe("refreshToken is required");
  });

  test("Auth test logout with missing env var", async () => {
    const tokenSecret = process.env.TOKEN_SECRET;
    delete process.env.TOKEN_SECRET;
    const response = await request(app)
      .post(baseUrl + "/logout")
      .send({ refreshToken: "some token" });
    expect(response.statusCode).toBe(500);
    expect(response.text).toBe("server error");
    process.env.TOKEN_SECRET = tokenSecret;
  });

  test("Auth test logout with non-existent user", async () => {
    const payload = { _id: new mongoose.Types.ObjectId(), random: 1 };
    const refreshToken = jwt.sign(
      payload,
      process.env.TOKEN_SECRET as string,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION }
    );
    const response = await request(app)
      .post(baseUrl + "/logout")
      .send({ refreshToken });
    expect(response.statusCode).toBe(404);
    expect(response.text).toBe("User not found");
  });

  test("Auth test logout with valid token but not found in user refreshToken array", async () => {
    const payload = { _id: testUser._id, random: 1 };
    const refreshToken = jwt.sign(
      payload,
      process.env.TOKEN_SECRET as string,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRATION }
    );
    const response = await request(app)
      .post(baseUrl + "/logout")
      .send({ refreshToken });
    expect(response.statusCode).toBe(401);
    expect(response.text).toBe("Unauthorized");
  });

  test("Expired access token is rejected", async () => {
    const response = await request(app)
      .post(baseUrl + "/login")
      .send(testUser);
    expect(response.statusCode).toBe(200);
    testUser.accessToken = response.body.accessToken;
    testUser.refreshToken = response.body.refreshToken;

    // Access tokens are issued for 24h, so build one that is already expired.
    const expiredToken = jwt.sign(
      { _id: testUser._id, random: 1 },
      process.env.TOKEN_SECRET as string,
      { expiresIn: -10 }
    );
    const response2 = await request(app)
      .get(protectedRoute())
      .set({ authorization: "JWT " + expiredToken });
    expect(response2.statusCode).toBe(401);
    expect(response2.text).toBe("Unauthorized - Token expired");

    // The client can then get a fresh access token through /auth/refresh
    const response3 = await request(app)
      .post(baseUrl + "/refresh")
      .send({ refreshToken: testUser.refreshToken });
    expect(response3.statusCode).toBe(200);
    testUser.accessToken = response3.body.accessToken;
    testUser.refreshToken = response3.body.refreshToken;

    const response4 = await request(app)
      .get(protectedRoute())
      .set({ authorization: "JWT " + testUser.accessToken });
    expect(response4.statusCode).toBe(200);
  });

  test("Expired access token is refreshed via refresh-token header", async () => {
    const expiredToken = jwt.sign(
      { _id: testUser._id, random: 1 },
      process.env.TOKEN_SECRET as string,
      { expiresIn: -10 }
    );
    const response = await request(app)
      .get(protectedRoute())
      .set({
        authorization: "JWT " + expiredToken,
        "refresh-token": testUser.refreshToken as string,
      });
    expect(response.statusCode).toBe(200);
    expect(response.headers["new-access-token"]).toBeDefined();
    expect(response.headers["new-refresh-token"]).toBeDefined();
    testUser.accessToken = response.headers["new-access-token"];
    testUser.refreshToken = response.headers["new-refresh-token"];

    // The used refresh token was rotated out
    const response2 = await request(app)
      .get(protectedRoute())
      .set({
        authorization: "JWT " + expiredToken,
        "refresh-token": "not-a-valid-refresh-token",
      });
    expect(response2.statusCode).toBe(401);
  });

  test("Middleware fails when TOKEN_SECRET is missing", async () => {
    const tokenSecret = process.env.TOKEN_SECRET;
    delete process.env.TOKEN_SECRET;
    const response = await request(app)
      .get(protectedRoute())
      .set({ authorization: "JWT " + testUser.accessToken });
    process.env.TOKEN_SECRET = tokenSecret;
    expect(response.statusCode).toBe(500);
    expect(response.text).toBe(
      "Server configuration error - TOKEN_SECRET not set"
    );
  });

  test("Get all users", async () => {
    const response = await request(app).get(baseUrl);
    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body)).toBeTruthy();
    const emails = response.body.map((u: iUser) => u.email);
    expect(emails).toContain(testUser.email);
  });

  test("Get user by ID", async () => {
    // Create a new user to test with
    const newUser = await userModel.create({
      email: "getusertest@auth.test",
      password: "123456",
      userName: "getUserTest",
      phoneNumber: "+972500000000",
    });

    const response = await request(app).get(baseUrl + "/" + newUser._id);
    expect(response.statusCode).toBe(200);
    expect(response.body.email).toBe(newUser.email);
    expect(response.body.userName).toBe(newUser.userName);
    expect(response.body.phoneNumber).toBe(newUser.phoneNumber);
  });

  test("Get user by non-existent ID", async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const response = await request(app).get(baseUrl + "/" + nonExistentId);
    expect(response.statusCode).toBe(404);
    expect(response.text).toBe("User not found");
  });

  test("Get user with invalid ID format", async () => {
    const response = await request(app).get(baseUrl + "/invalidid");
    expect(response.statusCode).toBe(400);
  });

  test("Update user", async () => {
    const newUser = await userModel.create({
      email: "updatetest@auth.test",
      password: "123456",
      userName: "updateTest",
      phoneNumber: "+972500000000",
    });

    const response = await request(app)
      .put(baseUrl + "/" + newUser._id)
      .send({ email: "updated@auth.test", phoneNumber: "+972511111111" });

    expect(response.statusCode).toBe(200);
    expect(response.body.email).toBe("updated@auth.test");
    expect(response.body.phoneNumber).toBe("+972511111111");
  });

  test("Update user password", async () => {
    const newUser = await userModel.create({
      email: "passwordupdate@auth.test",
      password: "123456",
      userName: "passwordUpdate",
      phoneNumber: "+972500000000",
    });

    const response = await request(app)
      .put(baseUrl + "/" + newUser._id)
      .send({ password: "newpassword" });

    expect(response.statusCode).toBe(200);

    // Check that password was hashed
    const updatedUser = await userModel.findById(newUser._id);
    expect(updatedUser?.password).not.toBe("newpassword");
  });

  test("Update user with non-existent ID", async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const response = await request(app)
      .put(baseUrl + "/" + nonExistentId)
      .send({ email: "updated2@auth.test" });
    expect(response.statusCode).toBe(404);
    expect(response.text).toBe("User not found");
  });

  test("Update user with existing username", async () => {
    const user1 = await userModel.create({
      email: "user1update@auth.test",
      password: "123456",
      userName: "user1update",
      phoneNumber: "+972500000000",
    });

    await userModel.create({
      email: "user2update@auth.test",
      password: "123456",
      userName: "user2update",
      phoneNumber: "+972500000000",
    });

    const response = await request(app)
      .put(baseUrl + "/" + user1._id)
      .send({ userName: "user2update" });

    expect(response.statusCode).toBe(400);
    expect(response.text).toBe("User name already exists");
  });

  test("Update user with invalid ID format", async () => {
    const response = await request(app)
      .put(baseUrl + "/invalidid")
      .send({ email: "updated3@auth.test" });
    expect(response.statusCode).toBe(400);
  });

  test("Delete user", async () => {
    const newUser = await userModel.create({
      email: "todelete@auth.test",
      password: "123456",
      userName: "userToDelete",
      phoneNumber: "+972500000000",
    });

    const response = await request(app).delete(baseUrl + "/" + newUser._id);
    expect(response.statusCode).toBe(200);
    expect(response.text).toBe("User deleted");

    const deletedUser = await userModel.findById(newUser._id);
    expect(deletedUser).toBeNull();
  });

  test("Delete non-existent user", async () => {
    const nonExistentId = new mongoose.Types.ObjectId();
    const response = await request(app).delete(baseUrl + "/" + nonExistentId);
    expect(response.statusCode).toBe(404);
    expect(response.text).toBe("User not found");
  });

  test("delete user fail", async () => {
    const response = await request(app).delete(baseUrl + "/123");
    expect(response.statusCode).not.toBe(200);
  });

  test("Google sign-in with invalid token", async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error("Wrong number of segments"));
    const response = await request(app)
      .post(baseUrl + "/google")
      .send({ credential: "invalid_token" });

    expect(response.statusCode).toBe(400);
    expect(response.text).toBe("Wrong number of segments");
  });

  test("Google sign-in with token without email", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({ getPayload: () => ({}) });
    const response = await request(app)
      .post(baseUrl + "/google")
      .send({ credential: "token_without_email" });

    expect(response.statusCode).toBe(400);
    expect(response.text).toBe("Invalid credentials");
  });

  test("Google sign-in creates a user and returns tokens", async () => {
    const payload = {
      email: "googleuser@auth.test",
      picture: "http://example.com/avatar.png",
    };
    mockVerifyIdToken.mockResolvedValue({ getPayload: () => payload });

    const response = await request(app)
      .post(baseUrl + "/google")
      .send({ credential: "valid_google_token" });
    expect(response.statusCode).toBe(200);
    expect(response.body.email).toBe(payload.email);
    expect(response.body.imgUrl).toBe(payload.picture);
    expect(response.body.accessToken).toBeDefined();
    expect(response.body.refreshToken).toBeDefined();
    expect(mockVerifyIdToken).toHaveBeenLastCalledWith(
      expect.objectContaining({ idToken: "valid_google_token" })
    );

    // Signing in again reuses the same account
    const response2 = await request(app)
      .post(baseUrl + "/google")
      .send({ credential: "valid_google_token" });
    expect(response2.statusCode).toBe(200);
    expect(response2.body._id).toBe(response.body._id);
    expect(await userModel.countDocuments({ email: payload.email })).toBe(1);
  });
});
