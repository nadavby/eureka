import request from "supertest";
import mongoose from "mongoose";
import express, { Express } from "express";
import initApp from "../server";
import { createRateLimiter } from "../middleware/security";

let app: Express;

beforeAll(async () => {
  app = await initApp();
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("http hardening", () => {
  it("sets security headers and a request id", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("echoes a caller-supplied request id", async () => {
    const res = await request(app).get("/health").set("X-Request-Id", "trace-123");
    expect(res.headers["x-request-id"]).toBe("trace-123");
  });

  it("allows configured origins only", async () => {
    const preflight = (origin: string) =>
      request(app).options("/items").set("Origin", origin).set("Access-Control-Request-Method", "GET");
    const ok = await preflight("http://localhost:5173");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const evil = await preflight("https://evil.example");
    expect(evil.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects oversized JSON bodies with 413", async () => {
    const res = await request(app).post("/auth/login").send({ email: "a@b.co", password: "x".repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe("PAYLOAD_TOO_LARGE");
  });

  it("returns JSON for unknown routes", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });
});

describe("rate limiting", () => {
  it("answers 429 with a JSON error once the limit is reached", async () => {
    const limited = express();
    limited.set("trust proxy", false);
    limited.get("/", createRateLimiter(60_000, 2, () => false), (_req, res) => {
      res.json({ ok: true });
    });
    expect((await request(limited).get("/")).status).toBe(200);
    expect((await request(limited).get("/")).status).toBe(200);
    const blocked = await request(limited).get("/");
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe("RATE_LIMITED");
  });
});
