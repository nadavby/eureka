import { RequestHandler } from "express";
import { TokenExpiredError } from "jsonwebtoken";
import { AppError, unauthorized } from "../lib/errors";
import { verifyToken } from "../lib/tokens";

const extractToken = (header?: string): string | null => {
  if (!header) return null;
  const [prefix, token] = header.split(" ");
  if ((prefix !== "Bearer" && prefix !== "JWT") || !token) return null;
  return token;
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req.header("authorization"));
  if (!token) return next(unauthorized("Missing or malformed Authorization header"));
  try {
    req.user = { id: verifyToken(token, "access") };
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) return next(new AppError(401, "TOKEN_EXPIRED", "Access token expired"));
    next(unauthorized("Invalid token"));
  }
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req.header("authorization"));
  if (token) {
    try {
      req.user = { id: verifyToken(token, "access") };
    } catch {
      // invalid token: continue as anonymous
    }
  }
  next();
};
