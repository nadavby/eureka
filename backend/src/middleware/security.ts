import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "../lib/config";

export const allowedOrigins = config.CLIENT_URLS;

export const corsMiddleware = cors({
  // Requests without an Origin header (curl, server-to-server, same-origin) are allowed.
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"],
  maxAge: 86400,
});

// Images under /public are loaded cross-origin by the SPA.
export const helmetMiddleware = helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } });

export const createRateLimiter = (windowMs: number, limit: number, skip = () => config.NODE_ENV === "test") =>
  rateLimit({
    windowMs,
    limit,
    skip,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "RATE_LIMITED", message: "Too many requests, please try again later" },
  });

/** Login, registration and token refresh: 30 requests per 15 minutes per IP. */
export const authLimiter = createRateLimiter(15 * 60 * 1000, 30);
/** Image uploads: 40 per hour per IP. */
export const uploadLimiter = createRateLimiter(60 * 60 * 1000, 40);
