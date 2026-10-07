import { RequestHandler } from "express";
import multer from "multer";
import { badRequest } from "../lib/errors";

// Fast pre-check only: the real format is verified from the bytes in processImage.
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif", "image/heic", "image/heif"]);
/** Raw upload limit. Photos are re-encoded to a much smaller WebP before storage. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

const rejectedUploads = new WeakSet<object>();

// A rejected file is skipped (not errored) so multer drains the rest of the request.
// Erroring inside the filter aborts mid-stream, and clients see a connection reset instead of a 400.
const failIfRejected: RequestHandler = (req, _res, next) =>
  next(rejectedUploads.has(req) ? badRequest("Only image uploads are allowed") : undefined);

/** Keeps at most one image in memory; it is processed and stored by the route handler. */
export const imageUpload = () => {
  const instance = multer({
    storage: multer.memoryStorage(),
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
