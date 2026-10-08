import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { logger } from "../lib/logger";

interface IndexDefinition {
  name: string;
  type: "vectorSearch";
  fields: Record<string, unknown>[];
}

const definitionPath = path.resolve(__dirname, "../../atlas/vector-index.json");

export const loadIndexDefinition = (): IndexDefinition => JSON.parse(fs.readFileSync(definitionPath, "utf8"));

/**
 * Creates the Atlas Vector Search index on `items` if it does not exist yet (idempotent).
 * Atlas builds it asynchronously; until it is ready, vector queries return no candidates.
 */
export const ensureVectorIndex = async () => {
  const { name, type, fields } = loadIndexDefinition();
  const items = mongoose.connection.collection("items");
  const existing = (await items.listSearchIndexes(name).toArray()) as { name: string; status?: string }[];
  if (existing.length) {
    logger.info({ name, status: existing[0].status }, "Vector search index present");
    return { created: false, status: String(existing[0].status ?? "unknown") };
  }
  await items.createSearchIndex({ name, type, definition: { fields } });
  logger.info({ name }, "Vector search index requested; Atlas is building it");
  return { created: true, status: "PENDING" };
};
