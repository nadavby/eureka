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
  GEMINI_MODEL_FAST: z.string().default("gemini-3.5-flash-lite"),
  GEMINI_MODEL_SMART: z.string().default("gemini-3.8-flash"),
  GEMINI_EMBED_MODEL: z.string().default("gemini-embedding-2"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().min(128).max(3072).default(768),
  AI_REQUESTS_PER_MINUTE: z.coerce.number().int().positive().default(12),
  VECTOR_SEARCH: z.enum(["memory", "atlas"]).optional(),
  MATCH_RADIUS_KM: z.coerce.number().positive().default(10),
  MATCH_THRESHOLD: z.coerce.number().min(0).max(100).default(70),
  GOOGLE_CLIENT_ID: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  SSL_KEY_PATH: z.string().optional(),
  SSL_CERT_PATH: z.string().optional(),
});

export type Config = Omit<z.infer<typeof schema>, "VECTOR_SEARCH"> & {
  CLIENT_URLS: string[];
  VECTOR_SEARCH: "memory" | "atlas";
};

export const parseConfig = (env: Record<string, string | undefined>): Config => {
  const result = schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const CLIENT_URLS = result.data.CLIENT_URL.split(",").map((s) => s.trim()).filter(Boolean);
  // Atlas Vector Search only exists on Atlas; everything else (tests, local Mongo) uses the in-memory search.
  const VECTOR_SEARCH = result.data.VECTOR_SEARCH ?? (result.data.NODE_ENV === "production" ? "atlas" : "memory");
  return { ...result.data, CLIENT_URLS, VECTOR_SEARCH };
};

export const config = parseConfig(process.env);
