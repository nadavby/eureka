import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { config } from "../lib/config";
import { signAccessToken } from "../lib/tokens";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { errorHandler } from "../middleware/error-handler";

const app = express();
app.get("/private", requireAuth, (req, res) => { res.json({ id: req.user!.id }); });
app.get("/public", optionalAuth, (req, res) => { res.json({ id: req.user?.id ?? null }); });
app.use(errorHandler);

describe("auth middleware", () => {
  it("accepts Bearer and JWT prefixes", async () => {
    const token = signAccessToken("u1");
    for (const prefix of ["Bearer", "JWT"]) {
      const res = await request(app).get("/private").set("Authorization", `${prefix} ${token}`);
      expect(res.body).toEqual({ id: "u1" });
    }
  });

  it("rejects missing, malformed and expired tokens with 401", async () => {
    const expired = jwt.sign({ _id: "u1", typ: "access" }, config.TOKEN_SECRET, { expiresIn: -10 });
    expect((await request(app).get("/private")).status).toBe(401);
    expect((await request(app).get("/private").set("Authorization", "Bearer nope")).status).toBe(401);
    const res = await request(app).get("/private").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("TOKEN_EXPIRED");
  });

  it("rejects a refresh token used as an access token", async () => {
    const refresh = jwt.sign({ _id: "u1", typ: "refresh" }, config.TOKEN_SECRET);
    const res = await request(app).get("/private").set("Authorization", `Bearer ${refresh}`);
    expect(res.status).toBe(401);
  });

  it("optionalAuth never fails", async () => {
    expect((await request(app).get("/public")).body).toEqual({ id: null });
    const res = await request(app).get("/public").set("Authorization", "Bearer junk");
    expect(res.body).toEqual({ id: null });
  });
});
