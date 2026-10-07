import mongoose from "mongoose";
import { config } from "../../lib/config";
import itemModel from "../../models/item_model";
import matchModel from "../../models/match_model";
import notificationModel from "../../models/notification_model";
import jobModel from "../../models/job_model";
import { JobQueue } from "../../jobs/job-queue";
import { InMemoryCandidateSearch } from "../../matching/candidate-search";
import { AiDisabledError, AiQuotaError } from "../../matching/errors";
import { registerMatchingJobs } from "../../matching";
import { PairVerdict } from "../../matching/types";
import { AiClient } from "../../matching/ai-client";

const category = "PipelineCategory";
const lostOwner = new mongoose.Types.ObjectId().toString();
const finder = new mongoose.Types.ObjectId().toString();

const attributes = {
  category,
  subcategory: "bifold wallet",
  brand: "",
  model: "",
  colors: ["brown"],
  material: "leather",
  distinctiveFeatures: ["torn corner"],
  visibleText: [],
  description: "brown leather wallet",
};

/** A fake Gemini: every item embeds to the same direction; the verdict is configurable per test. */
const makeAi = () => {
  let verdict: PairVerdict = { score: 91, verdict: "match", reasons: ["same torn corner"], conflicts: [] };
  return {
    setVerdict: (v: Partial<PairVerdict>) => (verdict = { ...verdict, ...v }),
    generateJson: jest.fn(async (req: { jsonSchema: { required?: unknown } }) =>
      (req.jsonSchema.required as string[]).includes("verdict") ? verdict : attributes
    ),
    embed: jest.fn(async () => [1, 0, 0]),
  };
};

let ai: ReturnType<typeof makeAi>;
let queue: JobQueue;
const emitted: { userId: string; event: string; payload: Record<string, unknown> }[] = [];

const createItem = (itemType: "lost" | "found", userId: string, extra: Record<string, unknown> = {}) =>
  itemModel.create({
    userId,
    itemType,
    imageUrl: `http://images.test/${itemType}.png`,
    category,
    date: new Date(itemType === "lost" ? "2026-03-01" : "2026-03-02"),
    location: { lat: 32.08, lng: 34.78 },
    description: `${itemType} wallet`,
    ...extra,
  });

const process = async (itemId: string) => {
  await queue.enqueue("analyze-item", { itemId });
  await queue.drain();
};

beforeAll(async () => {
  await mongoose.connect(config.DB_CONNECTION);
});

beforeEach(async () => {
  await Promise.all([
    itemModel.deleteMany({ category }),
    matchModel.deleteMany({ $or: [{ userId1: { $in: [lostOwner, finder] } }, { userId2: { $in: [lostOwner, finder] } }] }),
    notificationModel.deleteMany({ userId: { $in: [lostOwner, finder] } }),
    jobModel.deleteMany({}),
  ]);
  emitted.length = 0;
  ai = makeAi();
  queue = new JobQueue({ pollIntervalMs: 10, baseBackoffMs: 1, maxAttempts: 2 });
  registerMatchingJobs(queue, {
    ai: ai as unknown as AiClient,
    search: new InMemoryCandidateSearch(),
    loadImage: async () => ({ mimeType: "image/png", data: "QUJD" }),
    emitToUser: (userId, event, payload) => emitted.push({ userId, event, payload: payload as Record<string, unknown> }),
  });
});

afterAll(async () => {
  await itemModel.deleteMany({ category });
  await mongoose.connection.close();
});

describe("matching pipeline", () => {
  it("analyzes an item: stores attributes and embedding, then searches", async () => {
    const lost = await createItem("lost", lostOwner);
    await process(lost._id.toString());

    const saved = await itemModel.findById(lost._id).select("+embedding");
    expect(saved!.attributes!.distinctiveFeatures).toEqual(["torn corner"]);
    expect(saved!.embedding).toEqual([1, 0, 0]);
    expect(saved!.matchingStatus).toBe("done");
    expect(saved!.matchCount).toBe(0);
    expect(emitted.filter((e) => e.event === "item_status").map((e) => e.payload.status)).toEqual(["searching", "done"]);
  });

  it("matches a found item to the earlier lost item and notifies both owners", async () => {
    const lost = await createItem("lost", lostOwner);
    await process(lost._id.toString());
    const found = await createItem("found", finder);
    await process(found._id.toString());

    const matches = await matchModel.find({ item2Id: found._id.toString() });
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      item1Id: lost._id.toString(),
      userId1: lostOwner,
      userId2: finder,
      matchScore: 91,
      verdict: "match",
    });
    expect(matches[0].reasons).toEqual(["same torn corner"]);

    expect(await notificationModel.countDocuments({ matchId: matches[0]._id.toString() })).toBe(2);
    expect(emitted.filter((e) => e.event === "match_notification").map((e) => e.userId).sort()).toEqual(
      [lostOwner, finder].sort()
    );

    expect((await itemModel.findById(found._id))!.matchCount).toBe(1);
    expect((await itemModel.findById(lost._id))!.matchCount).toBe(1);
  });

  it("is idempotent: re-running a search does not duplicate matches or notifications", async () => {
    const lost = await createItem("lost", lostOwner);
    await process(lost._id.toString());
    const found = await createItem("found", finder);
    await process(found._id.toString());
    await queue.enqueue("find-matches", { itemId: found._id.toString() });
    await queue.drain();

    expect(await matchModel.countDocuments({ item2Id: found._id.toString() })).toBe(1);
    expect(await notificationModel.countDocuments({ userId: { $in: [lostOwner, finder] } })).toBe(2);
  });

  it("creates no match below the threshold", async () => {
    ai.setVerdict({ score: 40, verdict: "possible" });
    const lost = await createItem("lost", lostOwner);
    await process(lost._id.toString());
    const found = await createItem("found", finder);
    await process(found._id.toString());

    expect(await matchModel.countDocuments({ item2Id: found._id.toString() })).toBe(0);
    const saved = await itemModel.findById(found._id);
    expect(saved!.matchingStatus).toBe("done");
    expect(saved!.matchCount).toBe(0);
  });

  it("skips candidates the rules exclude, without calling the AI", async () => {
    const lost = await createItem("lost", lostOwner, { location: { lat: 31.25, lng: 34.79 } }); // ~90 km away
    await process(lost._id.toString());
    ai.generateJson.mockClear();
    const found = await createItem("found", finder);
    await process(found._id.toString());

    const rerankCalls = ai.generateJson.mock.calls.filter(([req]) => (req.jsonSchema.required as string[]).includes("verdict"));
    expect(rerankCalls).toHaveLength(0);
    expect(await matchModel.countDocuments({ item2Id: found._id.toString() })).toBe(0);
  });

  it("marks the item failed when AI is disabled, without retrying", async () => {
    ai.generateJson.mockRejectedValue(new AiDisabledError());
    const lost = await createItem("lost", lostOwner);
    await process(lost._id.toString());

    const saved = await itemModel.findById(lost._id);
    expect(saved!.matchingStatus).toBe("failed");
    expect(saved!.matchingError).toBe("AI matching is disabled");
    expect(ai.generateJson).toHaveBeenCalledTimes(1);
  });

  it("waits and retries later when the AI quota is exhausted", async () => {
    ai.generateJson.mockRejectedValueOnce(new AiQuotaError(60_000));
    const lost = await createItem("lost", lostOwner);
    await process(lost._id.toString());

    const job = await jobModel.findOne({ name: "analyze-item" });
    expect(job!.status).toBe("queued");
    expect(job!.attempts).toBe(0);
    expect(job!.runAt.getTime()).toBeGreaterThan(Date.now() + 50_000);
    expect((await itemModel.findById(lost._id))!.matchingStatus).toBe("analyzing");
  });

  it("marks the item failed after repeated unexpected errors", async () => {
    ai.embed.mockRejectedValue(new Error("network down"));
    const lost = await createItem("lost", lostOwner);
    await queue.enqueue("analyze-item", { itemId: lost._id.toString() });
    for (let i = 0; i < 2; i++) {
      await new Promise((r) => setTimeout(r, 10));
      await queue.drain();
    }
    const saved = await itemModel.findById(lost._id);
    expect(saved!.matchingStatus).toBe("failed");
    expect(saved!.matchingError).toBe("Matching failed, please try again later");
    expect(emitted.at(-1)).toMatchObject({ event: "item_status", payload: { status: "failed" } });
  });

  it("ignores jobs for items that were deleted in the meantime", async () => {
    await process(new mongoose.Types.ObjectId().toString());
    expect((await jobModel.findOne({ name: "analyze-item" }))!.status).toBe("done");
  });
});
