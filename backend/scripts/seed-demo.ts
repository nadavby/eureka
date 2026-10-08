/**
 * Rebuilds the demo world (bots, their public items, the visitor scenario template).
 *   npm run seed:demo
 * Uses the configured AI (GEMINI_API_KEY, or AI_FAKE=true) and image storage (Cloudinary or local).
 * Touches demo accounts only.
 */
import mongoose from "mongoose";
import { config } from "../src/lib/config";
import { seedDemo } from "../src/demo/seed";

const main = async () => {
  await mongoose.connect(config.DB_CONNECTION);
  const summary = await seedDemo();
  process.stdout.write(`${JSON.stringify(summary)}\n`);
  await mongoose.disconnect();
};

main().catch(async (err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : err}\n`);
  await mongoose.disconnect();
  process.exit(1);
});
