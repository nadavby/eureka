import request from "supertest";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { Express } from "express";
import initApp from "../server";
import { testImagePath } from "./test_utils";

let app: Express;
const uploadedFiles: string[] = [];

beforeAll(async () => {
  app = await initApp();
});

afterAll(async () => {
  for (const file of uploadedFiles) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  await mongoose.connection.close();
});

describe("profile picture upload", () => {
  it("stores a cleaned WebP and serves it back", async () => {
    const res = await request(app).post("/file").attach("file", testImagePath);
    expect(res.status).toBe(200);
    const url = (res.body.url as string).replace(/^.*\/\/[^/]+/, "");
    expect(url).toMatch(/^\/public\/users\/[0-9a-f-]{36}\.webp$/);
    uploadedFiles.push(path.join(process.cwd(), url));

    const served = await request(app).get(url).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on("data", (c: Buffer) => chunks.push(c));
      r.on("end", () => cb(null, Buffer.concat(chunks)));
    });
    expect(served.status).toBe(200);
    expect((await sharp(served.body as Buffer).metadata()).format).toBe("webp");
  });

  it("rejects non-image files", async () => {
    const res = await request(app).post("/file").attach("file", path.join(__dirname, "test_file.txt"));
    expect(res.status).toBe(400);
  });

  it("rejects a file that only pretends to be an image", async () => {
    const res = await request(app)
      .post("/file")
      .attach("file", Buffer.from("definitely not a png"), { filename: "avatar.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unsupported image/);
  });

  it("requires a file", async () => {
    const res = await request(app).post("/file");
    expect(res.status).toBe(400);
  });
});
