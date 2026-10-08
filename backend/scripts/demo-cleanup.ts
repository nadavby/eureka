/**
 * Removes demo visitors older than 24 hours with everything they created.
 *   npm run demo:cleanup
 */
import mongoose from "mongoose";
import { config } from "../src/lib/config";
import { cleanupExpiredVisitors } from "../src/demo/cleanup";

const main = async () => {
  await mongoose.connect(config.DB_CONNECTION);
  const result = await cleanupExpiredVisitors();
  process.stdout.write(`${JSON.stringify(result)}\n`);
  await mongoose.disconnect();
};

main().catch(async (err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : err}\n`);
  await mongoose.disconnect();
  process.exit(1);
});
