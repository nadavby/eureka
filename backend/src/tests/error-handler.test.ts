import express from "express";
import request from "supertest";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { forbidden } from "../lib/errors";
import { errorHandler, notFoundHandler } from "../middleware/error-handler";

const app = express();
app.get("/forbidden", asyncHandler(async () => { throw forbidden("Not yours"); }));
app.get("/zod", asyncHandler(async () => { z.object({ a: z.string() }).parse({}); }));
app.get("/boom", asyncHandler(async () => { throw new Error("secret internals"); }));
app.get("/multer", () => { throw new multer.MulterError("LIMIT_FILE_SIZE"); });
app.use(notFoundHandler);
app.use(errorHandler);

describe("errorHandler", () => {
  it("maps AppError", async () => {
    const res = await request(app).get("/forbidden");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "FORBIDDEN", message: "Not yours" });
  });

  it("maps ZodError to 400 with details", async () => {
    const res = await request(app).get("/zod");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(res.body.details[0].path).toEqual(["a"]);
  });

  it("hides internals on 500", async () => {
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "INTERNAL", message: "Something went wrong" });
  });

  it("maps file-too-large to 413", async () => {
    const res = await request(app).get("/multer");
    expect(res.status).toBe(413);
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });
});
