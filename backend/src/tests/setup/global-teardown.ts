import { MongoMemoryServer } from "mongodb-memory-server";

export default async () => {
  await (globalThis as { __MONGO__?: MongoMemoryServer }).__MONGO__?.stop();
};
