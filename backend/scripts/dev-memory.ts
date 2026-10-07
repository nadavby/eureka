/**
 * Runs the API against a throwaway in-memory MongoDB: no database to install.
 *   npm run dev:memory
 * Data is lost when the process stops.
 */
import { MongoMemoryServer } from "mongodb-memory-server";

const main = async () => {
  const mongo = await MongoMemoryServer.create();
  process.env.DB_CONNECTION = mongo.getUri("eureka-dev");
  process.stdout.write(`In-memory MongoDB at ${process.env.DB_CONNECTION}\n`);
  await import("../src/index");
  const stop = () => void mongo.stop().finally(() => process.exit(0));
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
};

void main();
