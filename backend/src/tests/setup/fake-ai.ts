import { AiClient, GenerateJsonRequest } from "../../matching/ai-client";
import { ItemAttributes, PairVerdict } from "../../matching/types";

/**
 * Deterministic stand-in for Gemini used by the API tests:
 * extraction echoes a fixed description, every item embeds to the same vector,
 * and the pair verdict is whatever the test sets.
 */
export const fakeAi = {
  verdict: { score: 90, verdict: "match", reasons: ["mock"], conflicts: [] } as PairVerdict,
  attributes: {
    category: "",
    subcategory: "",
    brand: "",
    model: "",
    colors: [],
    material: "",
    distinctiveFeatures: [],
    visibleText: [],
    description: "mock item",
  } as ItemAttributes,
  async generateJson<T>(req: GenerateJsonRequest<T>): Promise<T> {
    const isVerdict = (req.jsonSchema.required as string[]).includes("verdict");
    return (isVerdict ? this.verdict : this.attributes) as T;
  },
  async embed(): Promise<number[]> {
    return [1, 0, 0, 0];
  },
} satisfies AiClient & Record<string, unknown>;
