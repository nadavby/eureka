import request from "supertest";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { Express } from "express";
import initApp from "../server";
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

describe("File Tests", () => {
  test("upload file", async () => {
    const filePath = `${__dirname}/test_file.txt`;

    const response = await request(app)
      .post("/file")
      .attach("file", filePath);
    expect(response.statusCode).toEqual(200);
    let url: string = response.body.url;
    // On Windows multer returns a backslash path; normalize it for the request
    url = url.replace(/^.*\/\/[^/]+/, "").replace(/\\/g, "/");
    expect(url).toMatch(/^\/public\/users\/\d+\.txt$/);
    uploadedFiles.push(path.join(process.cwd(), url));

    const res = await request(app).get(url);
    expect(res.statusCode).toEqual(200);
    expect(res.text).toBe(fs.readFileSync(filePath, "utf8"));
  });
});
