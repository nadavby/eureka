import { RequestHandler } from "express";

// Placeholders; replaced by real rate limiters in the hardening task.
export const authLimiter: RequestHandler = (_req, _res, next) => next();
export const uploadLimiter: RequestHandler = (_req, _res, next) => next();
