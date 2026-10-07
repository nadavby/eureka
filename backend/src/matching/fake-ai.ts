import { createHash } from "crypto";
import { AiClient, GenerateJsonRequest, Part } from "./ai-client";

/**
 * Offline stand-in for Gemini, enabled with AI_FAKE=true (local development, E2E tests,
 * trying the app without an API key). It never looks at pixels: it works from the text
 * the pipeline sends, so results are deterministic.
 *  - extraction echoes the user's fields
 *  - embeddings are hashed bag-of-words vectors of the text
 *  - the pair score grows with the word overlap between the LOST and FOUND descriptions
 */
const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2);

const textOf = (parts: Part[]) => parts.map((p) => p.text ?? "").join("\n");

const hashedVector = (text: string, dims: number) => {
  const v = new Array<number>(dims).fill(0);
  for (const w of words(text)) {
    const h = createHash("md5").update(w).digest();
    v[h.readUInt32LE(0) % dims] += h[4] & 1 ? 1 : -1;
  }
  const norm = Math.hypot(...v) || 1;
  return v.map((x) => x / norm);
};

const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  const inter = [...A].filter((x) => B.has(x)).length;
  return A.size + B.size === 0 ? 0 : inter / (A.size + B.size - inter);
};

export class FakeAiClient implements AiClient {
  constructor(private readonly dims: number) {}

  async generateJson<T>(req: GenerateJsonRequest<T>): Promise<T> {
    const text = textOf(req.parts);
    const isVerdict = (req.jsonSchema.required as string[]).includes("verdict");
    if (isVerdict) {
      // Compare only the item descriptions: drop each section's header line and the "key: " labels.
      const section = (s = "") =>
        s
          .split("\n")
          .slice(1)
          .map((line) => line.replace(/^[a-z ]+:\s*/i, ""))
          .join(" ");
      const [, rawLost, rawFound] = text.split(/LOST ITEM|FOUND ITEM/);
      const lostPart = section(rawLost);
      const foundPart = section(rawFound);
      const shared = [...new Set(words(lostPart))].filter((w) => words(foundPart).includes(w));
      const score = Math.round(35 + 60 * Math.min(1, jaccard(words(lostPart), words(foundPart)) * 2.2));
      return req.schema.parse({
        score,
        verdict: score >= 70 ? "match" : score >= 45 ? "possible" : "no_match",
        reasons: shared.slice(0, 3).map((w) => `Both mention "${w}"`),
        conflicts: [],
      });
    }
    const fieldsJson = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    let fields: Record<string, unknown> = {};
    try {
      fields = JSON.parse(fieldsJson);
    } catch {
      /* no user fields */
    }
    const str = (k: string) => (typeof fields[k] === "string" ? (fields[k] as string) : "");
    return req.schema.parse({
      category: str("category"),
      subcategory: "",
      brand: str("brand"),
      model: "",
      colors: Array.isArray(fields.colors) ? fields.colors : [],
      material: str("material"),
      distinctiveFeatures: str("description") ? [str("description")] : [],
      visibleText: [],
      description: str("description") || str("category"),
    });
  }

  async embed(req: { model: string; parts: Part[] }): Promise<number[]> {
    return hashedVector(textOf(req.parts), this.dims);
  }
}

