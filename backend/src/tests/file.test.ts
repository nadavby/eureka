import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import initApp from "../server";
let app: Express;

beforeAll(async () => {
  app = await initApp();
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe("File Tests", () => {
  describe("File Tests", () => {
    test("upload file", async () => {
      const filePath = `${__dirname}/test_file.txt`;

      try {
        const response = await request(app)
          .post("/file?test_file.txt")
          .attach("file", filePath);
        expect(response.statusCode).toEqual(200);
        let url = response.body.url;
        url = url.replace(/^.*\/\/[^/]+/, "");
        const res = await request(app).get(url);
        expect(res.statusCode).toEqual(200);
      } catch (err) {
        console.log(err);
        expect(1).toEqual(2);
      }
    });
  });
});
