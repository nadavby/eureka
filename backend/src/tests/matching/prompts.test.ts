import path from "path";
import { analyzeItem } from "../../matching/item-analysis";
import { scorePair } from "../../matching/rerank";
import { embedItem } from "../../matching/embedding";
import { loadImage } from "../../matching/image-loader";
import { AiClient } from "../../matching/ai-client";
import { config } from "../../lib/config";

const image = { mimeType: "image/png", data: "QUJD" };

const fakeAi = (reply: unknown) => {
  const ai = {
    generateJson: jest.fn().mockResolvedValue(reply),
    embed: jest.fn().mockResolvedValue([0.5, 0.5]),
  };
  return ai as typeof ai & AiClient;
};

const attributes = {
  category: "wallet",
  subcategory: "bifold wallet",
  brand: "Unknown",
  model: "",
  colors: ["brown"],
  material: "leather",
  distinctiveFeatures: ["torn corner"],
  visibleText: [],
  description: "brown leather wallet",
};

describe("analyzeItem", () => {
  it("sends the photo and the user's fields to the fast model", async () => {
    const ai = fakeAi(attributes);
    await analyzeItem(ai, image, { itemType: "lost", category: "Wallet", description: "lost near the beach" });
    const req = ai.generateJson.mock.calls[0][0];
    expect(req.model).toBe(config.GEMINI_MODEL_FAST);
    expect(req.parts[0]).toEqual({ inlineData: image });
    expect(JSON.stringify(req.parts)).toContain("lost near the beach");
    expect(req.jsonSchema.required).toEqual(expect.arrayContaining(["category", "distinctiveFeatures"]));
  });

  it("lets what the user typed win over the model's guesses", async () => {
    const ai = fakeAi(attributes);
    const result = await analyzeItem(ai, image, { itemType: "found", category: "Wallet", brand: "Fossil" });
    expect(result.category).toBe("Wallet");
    expect(result.brand).toBe("Fossil");
    expect(result.distinctiveFeatures).toEqual(["torn corner"]);
  });
});

describe("scorePair", () => {
  const lost = { itemType: "lost" as const, category: "Wallet", attributes, description: "brown wallet" };
  const found = { itemType: "found" as const, category: "Wallet", attributes };

  it("sends both photos, labelled, to the smart model", async () => {
    const ai = fakeAi({ score: 88, verdict: "match", reasons: ["same torn corner"], conflicts: [] });
    await scorePair(ai, { item: lost, image }, { item: found, image: { ...image, data: "REVG" } });
    const req = ai.generateJson.mock.calls[0][0];
    expect(req.model).toBe(config.GEMINI_MODEL_SMART);
    const inline = req.parts.filter((p: { inlineData?: unknown }) => p.inlineData);
    expect(inline).toHaveLength(2);
    expect(JSON.stringify(req.parts)).toMatch(/LOST ITEM[\s\S]*FOUND ITEM/);
  });

  it("clamps the score and keeps verdict and reasons", async () => {
    const ai = fakeAi({ score: 140, verdict: "match", reasons: ["r"], conflicts: ["c"] });
    const verdict = await scorePair(ai, { item: lost, image }, { item: found, image });
    expect(verdict).toEqual({ score: 100, verdict: "match", reasons: ["r"], conflicts: ["c"] });
  });
});

describe("embedItem", () => {
  it("embeds the photo and the canonical text together", async () => {
    const ai = fakeAi(null);
    const vector = await embedItem(ai, image, { itemType: "lost", category: "Wallet", attributes });
    expect(vector).toEqual([0.5, 0.5]);
    const req = ai.embed.mock.calls[0][0];
    expect(req.model).toBe(config.GEMINI_EMBED_MODEL);
    expect(req.parts[0]).toEqual({ inlineData: image });
    expect(req.parts[1].text).toContain("bifold wallet");
  });
});

describe("loadImage", () => {
  it("reads local /public uploads from disk", async () => {
    const url = `${config.DOMAIN_BASE}/public/../src/tests/test_image.png`;
    await expect(loadImage(url)).rejects.toThrow(/outside/);
    const fs = await import("fs");
    const dir = path.join(process.cwd(), "public", "items");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "loader-test.png");
    fs.copyFileSync(path.join(__dirname, "..", "test_image.png"), file);
    try {
      const img = await loadImage(`${config.DOMAIN_BASE}/public/items/loader-test.png`);
      expect(img.mimeType).toBe("image/png");
      expect(Buffer.from(img.data, "base64").subarray(1, 4).toString()).toBe("PNG");
    } finally {
      fs.unlinkSync(file);
    }
  });
});
