import request from "supertest";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { Express } from "express";
import initApp from "../../server";
import userModel from "../../models/user_model";
import itemModel from "../../models/item_model";
import { itemFields } from "../test_utils";

jest.mock("../../matching/ai-client", () => ({
  ...jest.requireActual("../../matching/ai-client"),
  createAiClient: () => jest.requireActual("../setup/fake-ai").fakeAi,
}));

let app: Express;
let token: string;
let userId: string;

const fileOf = (imageUrl: string) => path.join(process.cwd(), imageUrl.replace(/^.*\/public\//, "public/"));

beforeAll(async () => {
  app = await initApp();
  await userModel.deleteMany({ email: /@privacy\.test$/ });
  await request(app).post("/auth/register").send({ email: "p@privacy.test", password: "password123", userName: "privacy", phoneNumber: "1" });
  const login = await request(app).post("/auth/login").send({ email: "p@privacy.test", password: "password123" });
  token = login.body.accessToken;
  userId = login.body._id;
});

afterAll(async () => {
  for (const item of await itemModel.find({ userId })) {
    if (fs.existsSync(fileOf(item.imageUrl))) fs.unlinkSync(fileOf(item.imageUrl));
  }
  await itemModel.deleteMany({ userId });
  await userModel.deleteMany({ email: /@privacy\.test$/ });
  await mongoose.connection.close();
});

const postPhoto = (photo: Buffer) => {
  let req = request(app).post("/items").set("Authorization", `Bearer ${token}`);
  for (const [k, v] of Object.entries(itemFields({ category: "PrivacyCategory" }))) {
    req = req.field(k, typeof v === "object" ? JSON.stringify(v) : String(v));
  }
  return req.attach("image", photo, { filename: "IMG_0001.jpg", contentType: "image/jpeg" });
};

describe("uploaded photos", () => {
  it("never keep the GPS position the phone embedded", async () => {
    const photo = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: "#7a5230" } })
      .jpeg()
      .withMetadata({
        exif: {
          IFD0: { Make: "SecretPhoneModel" },
          IFD3: { GPSLatitudeRef: "N", GPSLatitude: "32/1 5/1 0/1", GPSLongitudeRef: "E", GPSLongitude: "34/1 46/1 0/1" },
        },
      })
      .toBuffer();
    expect((await sharp(photo).metadata()).exif).toBeDefined();

    const res = await postPhoto(photo);
    expect(res.status).toBe(201);

    const stored = fs.readFileSync(fileOf(res.body.imageUrl));
    const meta = await sharp(stored).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(stored.includes(Buffer.from("SecretPhoneModel"))).toBe(false);
    expect(Math.max(meta.width!, meta.height!)).toBe(1600);
    expect(stored.length).toBeLessThan(photo.length);
  });

  it("are deleted together with their item", async () => {
    const res = await postPhoto(await sharp({ create: { width: 50, height: 50, channels: 3, background: "#000" } }).jpeg().toBuffer());
    const file = fileOf(res.body.imageUrl);
    expect(fs.existsSync(file)).toBe(true);
    const del = await request(app).delete(`/items/${res.body._id}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(200);
    expect(fs.existsSync(file)).toBe(false);
  });
});
