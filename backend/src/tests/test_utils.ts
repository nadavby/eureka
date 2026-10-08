/** @format */

import fs from "fs";
import path from "path";
import request from "supertest";
import { Express } from "express";

export const testImagePath = path.join(__dirname, "test_image.png");

const itemsDir = path.join(process.cwd(), "public", "items");

// Snapshot of the uploaded-items folder so a test file can remove only the
// images it uploaded itself.
export const listUploadedItemFiles = (): string[] =>
  fs.existsSync(itemsDir) ? fs.readdirSync(itemsDir) : [];

export const removeNewUploadedItemFiles = (before: string[]) => {
  for (const file of listUploadedItemFiles()) {
    if (!before.includes(file) && file !== ".gitkeep") {
      fs.unlinkSync(path.join(itemsDir, file));
    }
  }
};

export type ItemFields = {
  itemType?: string;
  kind?: string;
  description?: string;
  category?: string;
  date?: string;
  location?: { lat: number; lng: number };
  colors?: string;
  condition?: string;
  material?: string;
  brand?: string;
  userId?: string;
};

// Builds a complete, valid item payload (all fields required by item_model).
export const itemFields = (overrides: ItemFields = {}): ItemFields => ({
  itemType: "lost",
  description: "Black leather wallet",
  category: "Wallet",
  date: "2026-01-01T10:00:00.000Z",
  location: { lat: 32.0853, lng: 34.7818 },
  colors: "black",
  condition: "worn",
  material: "leather",
  ...overrides,
});

// POST /items is multipart/form-data: an image file plus text fields.
export const postItem = (
  app: Express,
  accessToken: string | undefined,
  fields: ItemFields,
  attachImage = true
) => {
  let req = request(app).post("/items");
  if (accessToken) {
    req = req.set("Authorization", "Bearer " + accessToken);
  }
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    req = req.field(
      key,
      typeof value === "object" ? JSON.stringify(value) : String(value)
    );
  }
  if (attachImage) {
    req = req.attach("image", testImagePath);
  }
  return req;
};
