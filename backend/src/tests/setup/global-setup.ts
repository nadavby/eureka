import { MongoMemoryServer } from "mongodb-memory-server";

// One in-memory MongoDB for the whole test run; no Docker or local mongod needed.
export default async () => {
  const mongo = await MongoMemoryServer.create();
  (globalThis as { __MONGO__?: MongoMemoryServer }).__MONGO__ = mongo;
  process.env.DB_CONNECTION = mongo.getUri("eureka-test");
};
