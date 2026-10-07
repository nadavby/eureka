import { RequestHandler } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { badRequest } from "../lib/errors";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const rejectedUploads = new WeakSet<object>();

// A rejected file is skipped (not errored) so multer drains the rest of the request.
// Erroring inside the filter aborts mid-stream, and clients see a connection reset instead of a 400.
const failIfRejected: RequestHandler = (req, _res, next) =>
  next(rejectedUploads.has(req) ? badRequest("Only image uploads are allowed") : undefined);

/** Disk upload of at most one image (5 MB), stored under public/<folder> with a random name. */
export const imageUpload = (folder: "items" | "users") => {
  const instance = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, path.join("public", folder)),
      filename: (_req, file, cb) =>
        cb(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 2 },
    fileFilter: (req, file, cb) => {
      if (IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
      rejectedUploads.add(req);
      cb(null, false);
    },
  });
  return {
    single: (field: string): RequestHandler[] => [instance.single(field), failIfRejected],
    fields: (fields: multer.Field[]): RequestHandler[] => [instance.fields(fields), failIfRejected],
  };
};
