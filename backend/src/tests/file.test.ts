import request from "supertest";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { Express } from "express";
import initApp from "../server";
import { testImagePath } from "./test_utils";

let app: Express;
const uploadedFiles: string[] = [];

beforeAll(async () => {
  app = await initApp();
});

afterAll(async () => {
  // Remove files this test uploaded to public/users
  for (const file of uploadedFiles) {
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  await mongoose.connection.close();
});

describe("profile picture upload", () => {
  it("stores an image and serves it back", async () => {
    const res = await request(app).post("/file").attach("file", testImagePath);
    expect(res.status).toBe(200);
    const url = (res.body.url as string).replace(/^.*\/\/[^/]+/, "");
    expect(url).toMatch(/^\/public\/users\/\d+-[0-9a-f-]+\.png$/);
    uploadedFiles.push(path.join(process.cwd(), url));

    const served = await request(app).get(url);
    expect(served.status).toBe(200);
    expect(served.body).toEqual(fs.readFileSync(testImagePath));
  });

  it("rejects non-image files", async () => {
    const res = await request(app).post("/file").attach("file", path.join(__dirname, "test_file.txt"));
    expect(res.status).toBe(400);
  });

  it("requires a file", async () => {
    const res = await request(app).post("/file");
    expect(res.status).toBe(400);
  });
});
