import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { config } from "./config";

export const logger = pino({
  level: config.LOG_LEVEL ?? (config.NODE_ENV === "test" ? "silent" : "info"),
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.refreshToken", "*.accessToken"],
  transport: config.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = (req.headers["x-request-id"] as string) || randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  autoLogging: { ignore: (req) => req.url === "/health" },
});
