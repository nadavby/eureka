import { FakeAiClient } from "../../matching/fake-ai";
import { itemAttributesSchema, pairVerdictSchema } from "../../matching/types";
import { attributesJsonSchema } from "../../matching/item-analysis";
import { verdictJsonSchema } from "../../matching/rerank";
import { cosineSimilarity } from "../../matching/candidate-search";

const ai = new FakeAiClient(64);

describe("FakeAiClient", () => {
  it("scores similar descriptions higher than different ones", async () => {
    const score = async (lost: string, found: string) =>
      (
        await ai.generateJson({
          model: "x",
          parts: [{ text: `LOST ITEM:\n${lost}` }, { text: `FOUND ITEM:\n${found}` }],
          jsonSchema: verdictJsonSchema,
          schema: pairVerdictSchema,
        })
      ).score;
    const same = await score("brown leather wallet torn corner initials", "brown leather wallet with torn corner");
    const different = await score("brown leather wallet torn corner", "silver car keys with red keychain");
    expect(same).toBeGreaterThanOrEqual(70);
    expect(different).toBeLessThan(70);
  });

  it("echoes the user's fields as attributes", async () => {
    const attrs = await ai.generateJson({
      model: "x",
      parts: [{ text: 'Details: {"itemType":"lost","category":"wallet","description":"torn corner"}' }],
      jsonSchema: attributesJsonSchema,
      schema: itemAttributesSchema,
    });
    expect(attrs.category).toBe("wallet");
    expect(attrs.distinctiveFeatures).toEqual(["torn corner"]);
  });

  it("embeds related text closer together", async () => {
    const a = await ai.embed({ model: "e", parts: [{ text: "brown leather wallet torn corner" }] });
    const b = await ai.embed({ model: "e", parts: [{ text: "brown leather wallet corner torn" }] });
    const c = await ai.embed({ model: "e", parts: [{ text: "silver car keys red keychain" }] });
    expect(a).toHaveLength(64);
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c));
  });
});
