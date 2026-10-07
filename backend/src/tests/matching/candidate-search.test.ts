import mongoose from "mongoose";
import itemModel from "../../models/item_model";
import { AtlasCandidateSearch, cosineSimilarity, InMemoryCandidateSearch } from "../../matching/candidate-search";
import { config } from "../../lib/config";

const category = "CandidateSearchCategory";
const base = {
  userId: "u1",
  imageUrl: "http://x/img.png",
  date: new Date("2026-01-01"),
  location: { lat: 32, lng: 34 },
  category,
};

beforeAll(async () => {
  await mongoose.connect(config.DB_CONNECTION);
});
afterAll(async () => {
  await itemModel.deleteMany({ category });
  await mongoose.connection.close();
});

describe("cosineSimilarity", () => {
  it("is 1 for identical direction and 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe("InMemoryCandidateSearch", () => {
  let target: InstanceType<typeof itemModel>;

  beforeAll(async () => {
    target = await itemModel.create({ ...base, itemType: "lost", embedding: [1, 0, 0] });
    await itemModel.create([
      { ...base, itemType: "found", description: "close", embedding: [0.9, 0.1, 0] },
      { ...base, itemType: "found", description: "far", embedding: [0, 1, 0] },
      { ...base, itemType: "found", description: "closest", embedding: [1, 0.01, 0] },
      { ...base, itemType: "found", description: "resolved", embedding: [1, 0, 0], isResolved: true },
      { ...base, itemType: "found", description: "no embedding yet" },
      { ...base, itemType: "lost", description: "same type", embedding: [1, 0, 0] },
      { ...base, itemType: "found", description: "other category", category: "Other", embedding: [1, 0, 0] },
    ]);
  });

  afterAll(async () => {
    await itemModel.deleteMany({ category: "Other" });
  });

  it("returns open, opposite-type, same-category items ranked by similarity", async () => {
    const results = await new InMemoryCandidateSearch().find(
      { _id: target._id.toString(), itemType: "lost", category, embedding: [1, 0, 0] },
      2
    );
    expect(results.map((r) => r.item.description)).toEqual(["closest", "close"]);
    expect(results[0].similarity).toBeGreaterThan(results[1].similarity);
  });

  it("does not filter by category when the item has none", async () => {
    const results = await new InMemoryCandidateSearch().find(
      { _id: target._id.toString(), itemType: "lost", embedding: [1, 0, 0] },
      10
    );
    expect(results.map((r) => r.item.description)).toContain("other category");
  });
});

describe("AtlasCandidateSearch", () => {
  it("builds a pre-filtered $vectorSearch pipeline", async () => {
    const aggregate = jest.fn().mockResolvedValue([]);
    const search = new AtlasCandidateSearch({ aggregate } as never, "item_embedding_index");
    await search.find({ _id: "507f1f77bcf86cd799439011", itemType: "found", category: "Wallet", embedding: [0.1, 0.2] }, 30);

    const [stage, project] = aggregate.mock.calls[0][0];
    expect(stage.$vectorSearch).toEqual({
      index: "item_embedding_index",
      path: "embedding",
      queryVector: [0.1, 0.2],
      numCandidates: 600,
      limit: 31,
      filter: { $and: [{ itemType: "lost" }, { isResolved: false }, { sandbox: false }, { category: "Wallet" }] },
    });
    expect(project.$project.similarity).toEqual({ $meta: "vectorSearchScore" });
    expect(project.$project.embedding).toBe(0);
  });
});
