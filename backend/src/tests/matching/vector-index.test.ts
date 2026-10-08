import { loadIndexDefinition } from "../../matching/vector-index";
import { config } from "../../lib/config";

describe("atlas/vector-index.json", () => {
  const def = loadIndexDefinition();

  it("indexes the embedding with the configured dimensions and cosine similarity", () => {
    expect(def).toMatchObject({ name: "item_embedding_index", type: "vectorSearch" });
    expect(def.fields).toContainEqual({ type: "vector", path: "embedding", numDimensions: config.EMBEDDING_DIMENSIONS, similarity: "cosine" });
  });

  it("declares every field the vector search pre-filters on", () => {
    const filters = def.fields.filter((f) => f.type === "filter").map((f) => f.path);
    expect(filters.sort()).toEqual(["category", "isResolved", "itemType", "sandbox"]);
  });
});
