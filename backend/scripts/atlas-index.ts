/**
 * Creates the Atlas Vector Search index from atlas/vector-index.json if it is missing.
 *   npm run atlas:index
 * The API also does this at startup when VECTOR_SEARCH=atlas.
 */
import mongoose from "mongoose";
import { config } from "../src/lib/config";
import { ensureVectorIndex } from "../src/matching/vector-index";

const main = async () => {
  await mongoose.connect(config.DB_CONNECTION);
  process.stdout.write(`${JSON.stringify(await ensureVectorIndex())}\n`);
  await mongoose.disconnect();
};

main().catch(async (err) => {
  process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
  await mongoose.disconnect();
  process.exit(1);
});
