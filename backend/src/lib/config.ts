import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_CONNECTION: z.string().min(1, "DB_CONNECTION is required"),
  DOMAIN_BASE: z.string().url().default("http://localhost:3000"),
  TOKEN_SECRET: z.string().min(32, "TOKEN_SECRET must be at least 32 characters"),
  TOKEN_EXPIRATION: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRATION: z.string().default("7d"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  GEMINI_API_KEY: z.string().default(""),
  GOOGLE_CLOUD_VISION_API_KEY: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  SSL_KEY_PATH: z.string().optional(),
  SSL_CERT_PATH: z.string().optional(),
});

export type Config = z.infer<typeof schema> & { CLIENT_URLS: string[] };

export const parseConfig = (env: Record<string, string | undefined>): Config => {
  const result = schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const CLIENT_URLS = result.data.CLIENT_URL.split(",").map((s) => s.trim()).filter(Boolean);
  return { ...result.data, CLIENT_URLS };
};

export const config = parseConfig(process.env);
