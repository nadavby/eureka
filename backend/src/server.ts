import express, { Express } from "express";
import path from "path";
import mongoose from "mongoose";
import swaggerJsDoc from "swagger-jsdoc";
import swaggerUI from "swagger-ui-express";
import cors from "cors";
import { config } from "./lib/config";
import { httpLogger, logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { getAllowedOrigins } from "./config/cors";
import authRoutes from "./routes/auth_routes";
import fileRoutes from "./routes/file_routes";
import itemRoutes from "./routes/item_routes";
import matchRoutes from "./routes/match_routes";
import notificationRoutes from "./routes/notification_routes";

const app = express();

app.disable("x-powered-by");
app.use(httpLogger);
app.use(
  cors({
    origin: getAllowedOrigins(),
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "Referer"],
    credentials: true,
    maxAge: 86400,
  })
);
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));

app.get("/health", (_req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  res.status(dbConnected ? 200 : 503).json({ status: dbConnected ? "ok" : "degraded", db: dbConnected });
});

app.use("/auth", authRoutes);
app.use("/file", fileRoutes);
app.use("/items", itemRoutes);
app.use("/match", matchRoutes);
app.use("/notification", notificationRoutes);
app.use("/public", express.static("public"));

const specs = swaggerJsDoc({
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Eureka Lost & Found API",
      version: "1.0.0",
      description: "REST API for reporting lost and found items and matching them with AI",
    },
    servers: [{ url: config.DOMAIN_BASE }],
  },
  // Resolved relative to this file so docs work from src (ts-node) and dist (compiled JS)
  apis: [path.join(__dirname, "routes", "*.{ts,js}")],
});
app.use("/api-docs", swaggerUI.serve, swaggerUI.setup(specs));

app.use(notFoundHandler);
app.use(errorHandler);

const initApp = async (): Promise<Express> => {
  mongoose.connection.on("error", (err) => logger.error({ err }, "MongoDB connection error"));
  await mongoose.connect(config.DB_CONNECTION);
  logger.info("Connected to MongoDB");
  return app;
};

export default initApp;
