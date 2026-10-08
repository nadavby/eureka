# Stage 2: Matching v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old flow, which ran inside the upload request: Vision, then loading every item, then one Gemini call per candidate. The new pipeline runs in the background:
1. Gemini extracts structured attributes.
2. A multimodal embedding is computed from the image plus those attributes.
3. Vector search finds candidates.
4. Rules filter the candidates.
5. Gemini reranks the top 5 with both images and returns reasons.
6. Matches are written idempotently, and status and notifications are pushed in real time.

**Architecture:** `src/matching/*` holds small, pure-where-possible units behind interfaces: the AI client, candidate search and the image loader. `src/jobs/job-queue.ts` is a MongoDB-backed queue that survives restarts. Upload saves the item with `matchingStatus: "analyzing"`, enqueues `analyze-item` and returns at once.

**Tech Stack:** `@google/genai` (replaces the deprecated `@google/generative-ai`), MongoDB Atlas `$vectorSearch` (M0 supports it, up to 3 indexes), Zod, Jest + mongodb-memory-server.

Spec: `docs/specs/2026-10-07-production-upgrade-design.md` §2.

## Deviations from the spec (decided during research, 2026-10-07)

1. **Multimodal embeddings.** `gemini-embedding-2` accepts images through the Gemini Developer API key. Each item's embedding is computed from **the image together with its canonical attribute text**, instead of text only. Similar-looking items now land near each other even when users describe them differently.
2. **Own job queue instead of Agenda.** Agenda 6 is ESM-only, and the backend is CommonJS on Node 20. A roughly 120-line queue gives atomic claim, lock expiry, retries with backoff and quota-aware rescheduling, and it's fully testable on mongodb-memory-server.
3. **No GeoJSON migration in this stage.** The vector search pre-filter can't express geo. The radius is enforced by the existing haversine post-filter on the top 30 candidates. `location {lat,lng}` stays as it is, so the frontend contract doesn't change.

## Models (configurable)

| Env | Default | Used for |
|---|---|---|
| `GEMINI_MODEL_FAST` | `gemini-3.5-flash-lite` | attribute extraction |
| `GEMINI_MODEL_SMART` | `gemini-3.8-flash` | pair reranking |
| `GEMINI_EMBED_MODEL` | `gemini-embedding-2` | multimodal embeddings, 768 dims (auto-normalized) |
| `VECTOR_SEARCH` | `memory` (dev/test), `atlas` (production) | candidate search implementation |
| `AI_REQUESTS_PER_MINUTE` | `12` | token-bucket guard for the free tier |
| `MATCH_RADIUS_KM` | `10` | geo post-filter |
| `MATCH_THRESHOLD` | `70` | minimum rerank score for a match |

## File map

| File | Responsibility |
|---|---|
| `src/matching/types.ts` | Zod schemas and types: `ItemAttributes`, `PairVerdict` |
| `src/matching/ai-client.ts` | `AiClient` interface plus the `GeminiAiClient` implementation: `generateJson`, `embed`; typed `AiDisabledError`/`AiQuotaError` |
| `src/matching/rate-limiter.ts` | Token bucket; `take()` throws `AiQuotaError` when empty |
| `src/matching/image-loader.ts` | `loadImage(url)` returns `{ mimeType, data(base64) }`. Local `/public/...` URLs come from disk, others from a fetch |
| `src/matching/item-analysis.ts` | Prompt and JSON schema for extracting `ItemAttributes` from the image and user fields |
| `src/matching/embedding.ts` | `canonicalText(item)` and `embedItem(ai, image, item)` |
| `src/matching/prefilter.ts` | Pure rules: opposite type, same category, found date ≥ lost date − 1 day, distance ≤ radius, unresolved |
| `src/matching/candidate-search.ts` | `CandidateSearch` interface, `AtlasCandidateSearch`, `InMemoryCandidateSearch` |
| `src/matching/rerank.ts` | Pair-scoring prompt with both images; returns a `PairVerdict` |
| `src/matching/pipeline.ts` | The `analyzeItem(itemId)` and `findMatches(itemId)` jobs: status transitions, idempotent match upsert, notifications |
| `src/matching/index.ts` | Wires the dependencies; `registerMatchingJobs(queue)` |
| `src/jobs/job-queue.ts` | `JobQueue`: `define`, `enqueue`, `start`, `stop`, `drain` (tests) |
| `src/models/job_model.ts` | The jobs collection |
| `src/models/item_model.ts` | Adds `attributes`, `embedding` (select:false), `matchingStatus`, `matchingError`, `matchCount`; removes `visionApiData` |
| `src/models/match_model.ts` | Adds `pairKey` (unique), `verdict`, `reasons[]`, `conflicts[]` |
| `atlas/vector-index.json` | The Atlas index definition, committed |
| `scripts/eval-matching.ts` + `eval/README.md` | Evaluation harness: precision, recall and F1 at the threshold |
| Delete | `services/vision-service.ts`, `gemini-service.ts`, `ai-matching-service.ts`, `matching-service.ts`; deps `@google-cloud/vision`, `@google/generative-ai`, `axios` |

## Tasks

### Task 1: Types, prefilter, canonical text (pure units, TDD)
- [ ] Tests in `src/tests/matching/prefilter.test.ts`:
  - Same category passes and a different category fails.
  - A found date before the lost date (beyond a 1-day tolerance) fails.
  - Distance: 9 km passes and 11 km fails at the 10 km radius.
  - Missing location or date doesn't exclude.
  - A resolved item fails.
  - Same type fails.
- [ ] Tests in `src/tests/matching/embedding.test.ts`: `canonicalText` is deterministic, orders fields stably, lower-cases, skips empty fields, and includes `distinctiveFeatures` and `visibleText`.
- [ ] Implement `types.ts`, `prefilter.ts`, `embedding.ts#canonicalText`. Commit.

### Task 2: Rate limiter + AI client (TDD with a fake SDK)
- [ ] Rate limiter tests: N takes succeed, take N+1 throws `AiQuotaError` with `retryAfterMs`, and tokens refill after the window (fake timers).
- [ ] AI client tests, with the SDK injected as `{ models: { generateContent, embedContent } }`:
  - `generateJson` parses the JSON and validates it with Zod.
  - Invalid JSON is retried once, and then it throws `AiResponseError`.
  - An SDK 429 is mapped to `AiQuotaError`.
  - `embed` returns `number[]` of the configured dimension.
  - No API key means `AiDisabledError`.
- [ ] Implement. Commit.

### Task 3: Job queue (TDD on memory server)
- [ ] Tests in `src/tests/jobs/job-queue.test.ts`:
  - An enqueued job runs exactly once with its data.
  - A failure is retried with backoff and marked `failed` after `maxAttempts`, with `lastError` saved.
  - A handler throwing `RescheduleError(ms)` is rescheduled without spending an attempt.
  - Two queue instances never run the same job twice (atomic claim).
  - A job whose lock expired (crashed worker) is reclaimed.
  - `drain()` runs everything that's due.
- [ ] Implement `job_model.ts`, `job-queue.ts`. Commit.

### Task 4: Candidate search (TDD)
- [ ] `InMemoryCandidateSearch` tests: returns the opposite-type, same-category, unresolved items with embeddings, sorted by cosine similarity, limited to `limit`, excluding the item itself.
- [ ] `AtlasCandidateSearch` unit test: builds the exact `$vectorSearch` pipeline (index name, path, `numCandidates` = 20 × limit, `filter` with `itemType`, `category`, `isResolved`). The test asserts on the pipeline passed to a fake `aggregate`.
- [ ] Commit `atlas/vector-index.json`.

### Task 5: Item analysis + rerank prompts
- [ ] Tests with a fake `AiClient`:
  - `analyzeItem` sends the image part and the user fields, uses `GEMINI_MODEL_FAST`, and returns validated attributes. User-provided category and brand take precedence over the model's guesses.
  - `scorePair` sends both images and both attribute sets, uses `GEMINI_MODEL_SMART`, and clamps the score to 0–100.
- [ ] Implement. Commit.

### Task 6: Pipeline + models
- [ ] Model changes, plus a `pairKey` unique index (`[a,b].sort().join(":")`).
- [ ] Tests in `src/tests/matching/pipeline.test.ts`, with a fake AI and an in-memory search on the real DB:
  - `analyzeItem` stores the attributes and the embedding, sets status `searching` and enqueues `find-matches`.
  - `findMatches` on a found item matches the earlier lost item:
    - a match is created with its score, verdict and reasons
    - 2 notifications are sent and 2 socket emits made
    - the status is `done` with `matchCount: 1`
  - Running `findMatches` twice creates no duplicate match (idempotent).
  - Below the threshold there's no match, the status is `done` and `matchCount` is 0.
  - With AI disabled, the status is `failed` and `matchingError` is "AI matching is disabled". The item still exists.
  - A quota error reschedules the job and leaves the status unchanged.
  - Every status transition emits `item_status` to the owner's room.
- [ ] Implement. Commit.

### Task 7: Wire into upload + boot
- [ ] `uploadItem`: save with `matchingStatus: "analyzing"`, `queue.enqueue("analyze-item", { itemId })`, respond 201 straight away.
- [ ] `index.ts`: create the queue, `registerMatchingJobs`, `queue.start()`, and stop gracefully on SIGTERM.
- [ ] Update `item.test.ts`, `match.test.ts` and `security.items.test.ts`:
  - Mock `src/matching/ai-client` instead of the vision and gemini services.
  - Call `await queue.drain()` after uploads, so matches exist deterministically.
- [ ] Delete the old services and dependencies.
- [ ] Run lint, typecheck and the full suite. Boot smoke test. Commit.

### Task 8: Evaluation harness
- [ ] `scripts/eval-matching.ts`:
  - Reads `eval/pairs.json`: `[{ lost: {image, fields}, found: {image, fields}, isMatch }]`.
  - Runs analyze, embed and scorePair with the real Gemini client.
  - Prints a confusion matrix plus precision, recall and F1 at `MATCH_THRESHOLD`.
  - Writes `eval/results.md`.
  - Uses the rate limiter, so it respects free-tier quotas.
- [ ] `npm run eval:matching`. Write `eval/README.md` on how to add pairs.
- [ ] The dataset (about 30 pairs with real photos) is collected during stage 5 (demo seed). Running it needs a real `GEMINI_API_KEY`.

### Task 9: Docs + PR
- [ ] README: replace the "How matching works" diagram and text, add a section on the job queue and statuses, and list the new env vars in `.env.example`.
- [ ] Push and open the PR (base: `stage1-foundation` until #2 merges).
