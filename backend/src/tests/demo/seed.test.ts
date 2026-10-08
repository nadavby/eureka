import fs from "fs";
import os from "os";
import path from "path";
import mongoose from "mongoose";
import { config } from "../../lib/config";
import userModel from "../../models/user_model";
import itemModel from "../../models/item_model";
import matchModel from "../../models/match_model";
import demoTemplateModel from "../../models/demo_template_model";
import { LocalImageStorage } from "../../images/storage";
import { FakeAiClient } from "../../matching/fake-ai";
import { InMemoryCandidateSearch } from "../../matching/candidate-search";
import { seedDemo } from "../../demo/seed";
import { cleanupExpiredVisitors, VISITOR_TTL_MS } from "../../demo/cleanup";
import { createVisitor } from "../../demo/scenario";
import { BOTS, ITEMS } from "../../demo/seed-data";

// Seeding rasterises 11 illustrations and runs the matching pipeline: slower than a unit test.
jest.setTimeout(60_000);

const root = fs.mkdtempSync(path.join(os.tmpdir(), "eureka-seed-"));
const storage = new LocalImageStorage(root, "http://localhost:3000/public");
const options = {
  storage,
  matching: {
    ai: new FakeAiClient(32),
    search: new InMemoryCandidateSearch(),
    emitToUser: () => undefined,
    // images live in the temporary storage root, not in public/
    loadImage: async (url: string) => ({
      mimeType: "image/webp",
      data: fs.readFileSync(path.join(root, url.replace("http://localhost:3000/public/", ""))).toString("base64"),
    }),
  },
};
const storedFiles = () => (fs.existsSync(path.join(root, "items")) ? fs.readdirSync(path.join(root, "items")) : []);

beforeAll(async () => {
  await mongoose.connect(config.DB_CONNECTION);
  await userModel.deleteMany({ demoRole: { $exists: true } });
});

afterAll(async () => {
  const ids = (await userModel.find({ demoRole: { $exists: true } })).map((u) => u._id.toString());
  await itemModel.deleteMany({ userId: { $in: ids } });
  await userModel.deleteMany({ _id: { $in: ids } });
  await userModel.deleteMany({ email: "real@seed.test" });
  await demoTemplateModel.deleteMany({});
  fs.rmSync(root, { recursive: true, force: true });
  await mongoose.connection.close();
});

describe("seedDemo", () => {
  it("creates the bots, their analysed public items and the visitor template", async () => {
    const summary = await seedDemo(options);
    expect(summary).toMatchObject({ bots: BOTS.length, items: ITEMS.length, analysed: ITEMS.length });

    const bots = await userModel.find({ demoRole: "seed" });
    expect(bots).toHaveLength(BOTS.length);
    const items = await itemModel.find({ userId: { $in: bots.map((b) => b._id.toString()) } }).select("+embedding");
    expect(items).toHaveLength(ITEMS.length);
    expect(items.every((i) => !i.sandbox && i.embedding!.length > 0 && i.matchingStatus === "done")).toBe(true);
    expect(await matchModel.countDocuments({ userId1: { $in: bots.map((b) => b._id.toString()) } })).toBe(0);
    expect(await demoTemplateModel.countDocuments()).toBe(1);
    expect(storedFiles()).toHaveLength(ITEMS.length + 2);
  });

  it("is idempotent: a reseed replaces the demo world and its images, and removes visitors", async () => {
    await createVisitor();
    await seedDemo(options);
    expect(await userModel.countDocuments({ demoRole: "seed" })).toBe(BOTS.length);
    expect(await userModel.countDocuments({ demoRole: "visitor" })).toBe(0);
    expect(await demoTemplateModel.countDocuments()).toBe(1);
    expect(storedFiles()).toHaveLength(ITEMS.length + 2);
  });
});

describe("cleanupExpiredVisitors", () => {
  it("removes only visitors older than a day, with their sandboxes", async () => {
    const real = await userModel.create({ email: "real@seed.test", password: "x", userName: "Real", phoneNumber: "1" });
    const old = await createVisitor();
    const fresh = await createVisitor();
    await userModel.collection.updateOne({ _id: new mongoose.Types.ObjectId(old.visitor._id.toString()) }, { $set: { createdAt: new Date(Date.now() - VISITOR_TTL_MS - 1000) } });

    const result = await cleanupExpiredVisitors(Date.now(), storage);
    expect(result.users).toBe(1);
    expect(await userModel.exists({ _id: old.visitor._id })).toBeNull();
    expect(await itemModel.countDocuments({ sandboxOwnerId: old.visitor._id.toString() })).toBe(0);
    expect(await matchModel.exists({ _id: old.matchId })).toBeNull();

    expect(await userModel.exists({ _id: fresh.visitor._id })).not.toBeNull();
    expect(await userModel.exists({ _id: real._id })).not.toBeNull();
    expect(await userModel.countDocuments({ demoRole: "seed" })).toBe(BOTS.length);
    // the shared template images survive a visitor cleanup
    expect(storedFiles()).toHaveLength(ITEMS.length + 2);
  });
});
