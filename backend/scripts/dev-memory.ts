/**
 * Runs the API against a throwaway in-memory MongoDB: no database to install.
 *   npm run dev:memory            empty database
 *   npm run dev:demo              + offline AI (AI_FAKE) + the demo world seeded
 * Data is lost when the process stops.
 */
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.DB_CONNECTION = mongo.getUri("eureka-dev");
  process.stdout.write(`In-memory MongoDB at ${process.env.DB_CONNECTION}\n`);
  await import("../src/index");

  if (process.env.SEED_DEMO === "true") {
    while (mongoose.connection.readyState !== 1) await new Promise((r) => setTimeout(r, 100));
    const { seedDemo } = await import("../src/demo/seed");
    await seedDemo();
    process.stdout.write("Demo seeded: open the app and click Try the demo\n");
  }

  const stop = () => void mongo.stop().finally(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
};

void main();
