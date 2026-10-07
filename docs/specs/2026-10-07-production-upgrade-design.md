# Eureka production upgrade: design

Date: 2026-10-07
Status: approved in conversation, pending spec review

## Goal

Turn Eureka from a final-project codebase into a production-grade, publicly deployed app that a recruiter can open, try in one click, and read. Success criteria:

1. A public URL with a "Try demo" button that works on a cold start within ~60 s (free-tier wake-up) and instantly afterwards.
2. Matching produces correct matches on the seeded demo data and has a measured precision figure from an evaluation script.
3. No known authorization holes (identity always from the JWT, ownership enforced, sockets authenticated).
4. CI runs lint, type-check, unit, integration and E2E tests, then deploys on `main`.
5. A README with a GIF, an architecture diagram, the pipeline explanation, the eval number and the demo link.

## Constraints

- **Free tier only:** MongoDB Atlas M0, Render free web service (Docker, sleeps after idle), Vercel Hobby for the frontend, Cloudinary free plan, Gemini API free tier.
- **Stack stays:** React 18 + Vite + TypeScript frontend, Express + TypeScript + Mongoose backend, Socket.IO.
- **Languages:** English and Hebrew, with RTL.
- **Keep** the home-page particle animation (`EurekaParticles` + `eureka-logo-path.ts`) and restyle around it.

## Work packages (in order)

### 1. Foundation and security

- Merge the existing `feat/docker-ci` work (Docker, CI, 83 tests) as the base.
- **Identity:** `userId` comes only from `req.user` (JWT). Remove every `userId` read from body or params on write routes.
- **Ownership:** update, delete and resolve on items and matches check `item.userId === req.user.id`; otherwise 403.
- **Socket auth:** a JWT in `handshake.auth.token`, verified in an `io.use()` middleware. The user joins only their own room. Chat joins check that the user is a participant.
- **Validation:** Zod schemas for every request body and query, plus one `validate()` middleware.
- **Hardening:**
  - helmet
  - `express-rate-limit` on auth and upload routes
  - CORS allow-list from env
  - a 5 MB upload limit with image MIME check
- **Logging:**
  - pino and pino-http with a request id.
  - Replace all `console.*`.
  - Never log tokens.
- **Errors:** one central error handler and an `AppError` class with consistent JSON errors.
- **Config:** a typed `config.ts` validated with Zod at boot, so the server fails fast on missing env.
- **Cleanup:**
  - Remove `openai`, `opencv-wasm`, `opencv.js`, the Post/Comment fixtures and the hardcoded IPs.
  - Rename `RegristrationForm`.
  - Fill in the missing Swagger docs for the match and notification routes.

### 2. Matching v2

Replaces the Vision → load-all → Gemini-per-candidate flow, which ran synchronously inside the upload request. Google Cloud Vision is removed.

```
upload ─► item saved (status: analyzing) ─► job: analyze-item
  analyze-item:
    Gemini Flash (image + user fields) ─► responseSchema JSON
      { category, subcategory, brand, model, colors[], material,
        distinctiveFeatures[], visibleText[], description }
    text embedding of a canonical attribute string ─► item.embedding
    status: searching ─► enqueue find-matches
  find-matches:
    Atlas $vectorSearch on opposite itemType
      filter: itemType, category, isResolved=false, date window
      numCandidates 200, limit 30
    geo filter: haversine ≤ radius (default 10 km, configurable)
    top 5 by vector score ─► rerank
  rerank (per candidate, parallel, concurrency 3):
    Gemini Flash with BOTH images + both attribute sets
      ─► { score 0-100, verdict: match|possible|no, reasons[], conflicts[] }
    score ≥ 70 ─► Match saved (idempotent on the lost/found pair)
             ─► notification + Socket.IO event to both owners
    status: done (with matchCount)
```

- **Model names** come from env (`GEMINI_MODEL`, `GEMINI_EMBED_MODEL`) and default to current stable models, checked against the docs at implementation time.
- **Structured output:** `responseMimeType: application/json` + `responseSchema`, validated again with Zod. An invalid response is retried once and then marked as failed. A failure is never silently turned into score 0.
- **Job queue:** Agenda (MongoDB-backed), so jobs survive Render sleep and restarts. Retries use exponential backoff (3 attempts), and stuck jobs are reclaimed on boot.
- **Status:** `item.matchingStatus: analyzing | searching | done | failed`. Each transition is pushed over Socket.IO to the owner.
- **Data model:**
  - `location` becomes GeoJSON `Point` with a `2dsphere` index, migrated from `{lat,lng}`.
  - `embedding: number[]` with an Atlas Vector Search index (definition committed in `backend/atlas/vector-index.json`).
  - The `Match` model gains `reasons[]`, `conflicts[]`, `verdict`, and a unique index on `(lostItemId, foundItemId)`.
- **Free-tier guard:** a per-minute token-bucket limiter around Gemini calls. When over quota, a job is re-scheduled instead of failing.
- **Evaluation:** `npm run eval:matching` runs the pipeline over `backend/eval/pairs.json` (~30 labeled lost/found pairs, positives and hard negatives, with images in `backend/eval/images/`). It prints precision, recall and F1 at the 70 threshold, and saves the results to `backend/eval/results.md`. The README quotes this number.

### 3. Images

- Uploads go to Cloudinary through the backend (signed upload, multer memory storage). The DB stores the `secure_url` and `public_id`; the local `public/` folder is removed.
- The browser downscales images to a 1600 px long edge (WebP) before upload.
- Items show Cloudinary transformation URLs for thumbnails.

### 4. UI redesign

- **Styling:**
  - Tailwind v4 + shadcn/ui only.
  - Remove Bootstrap, react-bootstrap, FontAwesome and every component `.css` file.
  - Icons come from lucide-react.
- **i18n:**
  - react-i18next with `en` and `he` namespaces.
  - `dir` is set on `<html>` from the language.
  - Logical CSS properties (`ms-`/`me-`, `start`/`end`) everywhere, so RTL works without overrides.
  - The language toggle is in the header and saved in localStorage.
- **Themes:** dark and light, using shadcn CSS variables and a theme toggle.
- **Data layer:**
  - TanStack Query for server state; this replaces the ad-hoc `useItems`/`useMatch` hooks.
  - One axios client with refresh-token rotation.
  - The socket client authenticates with the JWT.
- **Screens:**
  - **Landing (`/`):** the existing particle animation as the hero, a "Try demo" button, a sign-in button, how-it-works in three steps, and a live counter of reunited items.
  - **Report (`/report/lost`, `/report/found`):** a three-step wizard (photo → details → location and date). When the photo is added, AI analysis prefills category, brand and colors, and the user confirms or edits them.
  - **My items (`/items`):** cards with a live matching-status chip (analyzing / searching / N matches).
  - **Item detail (`/items/:id`):** the item, its candidate matches, and actions.
  - **Match (`/matches/:id`):** both photos side by side, a score gauge, reasons and conflicts, confirm or reject, and open chat.
  - **Chat (`/chats`, `/chats/:id`):** conversation list plus thread; typing indicator; unread counts.
  - **Map (`/map`):** lost items on Leaflet (Google Maps removed to avoid an API key), with clustering.
  - **Profile (`/profile`, `/u/:id`):** user details and their QR code.
- **States:** every data view has skeleton, empty and error states. Toasts for notifications.
- **Accessibility:** labelled form fields, focus rings, keyboard-reachable dialogs (Radix through shadcn), and `prefers-reduced-motion` disables the particle animation.

### 5. Demo mode

- `POST /auth/demo` issues a session for a fixed demo user. That user can create items (rate-limited) but can't change the profile, email or password.
- `npm run seed:demo` wipes the demo data and inserts:
  - about 12 lost and found items with real photos (Cloudinary folder `eureka-demo`)
  - 2 pre-computed matches
  - one chat with messages
  - a "counterpart" demo user
- A GitHub Actions cron runs the seed every night at 03:00 UTC against production.

### 6. Deployment

- **Backend:** Render web service from `backend/Dockerfile`, health check at `/health`; the Agenda worker runs in the same process.
- **Frontend:** Vercel (Vite static build) with a SPA rewrite; `VITE_API_URL` points to the Render URL.
- **Database:** Atlas M0 with a Vector Search index; IP access is open to Render's egress.
- **CI:**
  - Lint, type-check and tests on every PR.
  - On `main`: build the images, trigger the Render deploy hook, and Vercel deploys from Git.
- Secrets live only in the Render, Vercel and GitHub settings, and `.env.example` documents every variable.

### 7. Testing

- **Backend unit (Jest):**
  - the geo and date filters
  - the canonical attribute string
  - score thresholds
  - Zod schemas
  - the authorization helpers
- **Backend integration (Jest + mongodb-memory-server, Gemini mocked):**
  - auth, including the demo user
  - item CRUD with ownership checks returning 403
  - the matching pipeline end to end with a fake vector search adapter
  - socket auth
- **Vector search:** isolated behind a `CandidateSearch` interface with an Atlas implementation and an in-memory cosine implementation for tests.
- **Frontend:** Vitest + Testing Library for the wizard, the status chip and RTL rendering.
- **E2E:** Playwright against docker-compose (Gemini mocked through an env flag): demo login → report a found item → the match appears → open chat → send a message. Runs in CI.

### 8. README and presentation

- A hero GIF of the report → match flow, plus screenshots in both languages.
- A Mermaid architecture diagram, the pipeline explanation, and the eval results table.
- A "Production concerns" section covering auth, rate limits, idempotency, queue retries and free-tier quota handling.
- The live demo link and badges (CI, license).
- The background section stays as written.

## Out of scope

- Push notifications and email.
- Native mobile.
- Image embeddings (CLIP or Vertex multimodal), which aren't possible on the free tier.
- Admin panel.
- Moderation beyond the rate limits.

## Risks

- **Gemini free-tier quotas** can throttle the demo. Mitigation: the limiter plus pre-computed demo matches, so the demo looks complete even when the quota is exhausted.
- **Render cold start (~50 s).** Mitigation: the landing page is static on Vercel and shows a "waking up server" state while it pings `/health`.
- **Atlas M0 vector search limits** (index count and size) are fine at demo scale.
