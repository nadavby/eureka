/**
 * Measures matching quality on a labelled set of lost/found pairs, using the real Gemini models.
 *
 *   npm run eval:matching            # all pairs in eval/pairs.json
 *   npm run eval:matching -- --limit 5
 *
 * Requires GEMINI_API_KEY. Writes eval/results.md. See eval/README.md for the data format.
 */
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { config } from "../src/lib/config";
import { createAiClient } from "../src/matching/ai-client";
import { AiQuotaError } from "../src/matching/errors";
import { analyzeItem, UserFields } from "../src/matching/item-analysis";
import { embedItem } from "../src/matching/embedding";
import { scorePair } from "../src/matching/rerank";
import { cosineSimilarity } from "../src/matching/candidate-search";
import { computeMetrics } from "../src/matching/metrics";
import { ImageData } from "../src/matching/image-loader";

const EVAL_DIR = path.join(__dirname, "..", "eval");

const sideSchema = z.object({
  image: z.string(),
  fields: z.object({
    category: z.string().optional(),
    brand: z.string().optional(),
    colors: z.array(z.string()).optional(),
    description: z.string().optional(),
  }),
});
const pairsSchema = z.array(
  z.object({ id: z.string(), lost: sideSchema, found: sideSchema, isMatch: z.boolean(), note: z.string().optional() })
);

const out = (line = "") => process.stdout.write(line + "\n");
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const readImage = async (file: string): Promise<ImageData> => {
  const ext = path.extname(file).toLowerCase();
  const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  return { mimeType, data: (await fs.readFile(path.join(EVAL_DIR, "images", file))).toString("base64") };
};

/** Retries a call after the limiter's suggested wait, so a long run survives free-tier limits. */
const withQuotaWait = async <T>(fn: () => Promise<T>): Promise<T> => {
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof AiQuotaError)) throw err;
      out(`  rate limited, waiting ${Math.ceil(err.retryAfterMs / 1000)}s`);
      await new Promise((r) => setTimeout(r, err.retryAfterMs + 250));
    }
  }
};

const main = async () => {
  if (!config.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required for the evaluation");
  const limitArg = process.argv.indexOf("--limit");
  const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;
  const pairs = pairsSchema.parse(JSON.parse(await fs.readFile(path.join(EVAL_DIR, "pairs.json"), "utf8"))).slice(0, limit);
  const ai = createAiClient();

  const rows: { id: string; isMatch: boolean; similarity: number; score: number; verdict: string; reasons: string[] }[] = [];
  for (const pair of pairs) {
    out(`${pair.id} (${pair.isMatch ? "match" : "different"})`);
    const prepare = async (side: z.infer<typeof sideSchema>, itemType: "lost" | "found") => {
      const image = await readImage(side.image);
      const fields: UserFields = { itemType, ...side.fields };
      const attributes = await withQuotaWait(() => analyzeItem(ai, image, fields));
      const item = { ...fields, attributes };
      const embedding = await withQuotaWait(() => embedItem(ai, image, item));
      return { item, image, embedding };
    };
    const lost = await prepare(pair.lost, "lost");
    const found = await prepare(pair.found, "found");
    const verdict = await withQuotaWait(() => scorePair(ai, lost, found));
    const similarity = cosineSimilarity(lost.embedding, found.embedding);
    rows.push({ id: pair.id, isMatch: pair.isMatch, similarity, score: verdict.score, verdict: verdict.verdict, reasons: verdict.reasons });
    out(`  similarity ${similarity.toFixed(3)}  score ${verdict.score}  ${verdict.verdict}`);
  }

  const m = computeMetrics(rows, config.MATCH_THRESHOLD);
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const sim = (isMatch: boolean) => avg(rows.filter((r) => r.isMatch === isMatch).map((r) => r.similarity));

  const report = [
    "# Matching evaluation",
    "",
    `Run: ${new Date().toISOString().slice(0, 10)} · pairs: ${rows.length} · threshold: ${config.MATCH_THRESHOLD}`,
    `Models: extraction \`${config.GEMINI_MODEL_FAST}\`, rerank \`${config.GEMINI_MODEL_SMART}\`, embedding \`${config.GEMINI_EMBED_MODEL}\` (${config.EMBEDDING_DIMENSIONS}d)`,
    "",
    "| Metric | Value |",
    "|---|---|",
    `| Precision | ${pct(m.precision)} |`,
    `| Recall | ${pct(m.recall)} |`,
    `| F1 | ${pct(m.f1)} |`,
    `| Accuracy | ${pct(m.accuracy)} |`,
    `| Confusion (TP / FP / FN / TN) | ${m.tp} / ${m.fp} / ${m.fn} / ${m.tn} |`,
    `| Mean embedding similarity, true pairs | ${sim(true).toFixed(3)} |`,
    `| Mean embedding similarity, different items | ${sim(false).toFixed(3)} |`,
    "",
    "| Pair | Truth | Similarity | Score | Verdict | Reasons |",
    "|---|---|---|---|---|---|",
    ...rows.map(
      (r) =>
        `| ${r.id} | ${r.isMatch ? "match" : "different"} | ${r.similarity.toFixed(3)} | ${r.score} | ${r.verdict} | ${r.reasons.join("; ").replace(/\|/g, "/")} |`
    ),
    "",
  ].join("\n");

  await fs.writeFile(path.join(EVAL_DIR, "results.md"), report);
  out();
  out(`precision ${pct(m.precision)}  recall ${pct(m.recall)}  F1 ${pct(m.f1)}  -> eval/results.md`);
};

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : err}\n`);
  process.exit(1);
});
