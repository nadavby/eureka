import { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Invalid request",
      details: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Invalid request",
      details: Object.values(err.errors).map((e) => ({ path: [e.path], message: e.message })),
    });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: "BAD_REQUEST", message: `Invalid ${err.path}` });
    return;
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: err.code, message: err.message });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Request body too large" });
    return;
  }
  (req.log ?? logger).error({ err }, "Unhandled error");
  res.status(500).json({ error: "INTERNAL", message: "Something went wrong" });
};
