# Eureka — AI-powered Lost & Found

[![CI](https://github.com/nadavby/eureka/actions/workflows/ci.yml/badge.svg)](https://github.com/nadavby/eureka/actions/workflows/ci.yml)

Eureka reunites people with lost items. Users report a **lost** or **found** item with a photo and location. In the background, Gemini describes the object, a multimodal embedding of the photo and its description finds look-alike candidates, and a second model compares the best candidates photo-to-photo. Both owners are notified in real time and can chat to confirm.

## Try it

**Try the demo** on the home page signs you in as a temporary guest and opens a ready-made match: your lost wallet next to a wallet a resident found, with the reasons the AI gave. From there you can chat with the finder (they answer), confirm the match to see their contact details, or report your own item and watch it being matched against the demo world.

Every guest gets a **private sandbox**: what you report or confirm is invisible to other visitors, the public demo items are never changed, and guest accounts are deleted within a day. A [nightly workflow](.github/workflows/demo-reset.yml) rebuilds the demo world. The demo illustrations were drawn for this project.

## How matching works

```
POST /items ──► item saved (matchingStatus: analyzing) ──► 201 in ~20 ms
                         │
                         ▼  job queue (MongoDB, survives restarts)
 analyze-item   Gemini Flash-Lite: photo + user fields ──► structured attributes (JSON schema)
                gemini-embedding-2: photo + canonical text ──► one 768-d vector
                         │
                         ▼
 find-matches   Atlas Vector Search: 30 nearest items of the opposite type, same category
                rules: found date ≥ lost date − 1 day · distance ≤ 10 km · still open
                Gemini Flash: both photos side by side, top 5 only
                    ──► { score 0-100, verdict, reasons[], conflicts[] }
                         │
          score ≥ 70 ──► match upserted by pairKey (idempotent) ──► notifications + Socket.IO
                         │
                         ▼
                item_status events: analyzing → searching → done (matchCount) / failed
```

Design choices:

- **The upload never waits for AI.** Work runs on a small durable job queue (`backend/src/jobs`). Claims are atomic, the locks of a crashed worker expire, failures retry with exponential backoff, and quota errors are rescheduled without spending an attempt.
- **Cheap steps first.** Vector search and plain rules narrow the candidates before any expensive model call. Only 5 pairs per item reach the reranker, so this stays inside the Gemini free tier. A local rate limiter holds jobs back before the provider starts returning 429s.
- **Embeddings see the photo.** The vector is computed from the image *and* the canonical attribute text together, so two photos of the same object land close together even when their owners describe it differently.
- **The model is not trusted blindly.** Structured output is validated again with Zod, and an invalid reply is retried once and then fails visibly; it is never silently scored as 0. The prompts tell the model to ignore instructions embedded in photos or user text.
- **Measured, not guessed.** `npm run eval:matching` reports precision, recall and F1 on labelled pairs (see [backend/eval](backend/eval/README.md)).

## Features

- Report a lost or found item in three steps: photo (resized in the browser), details, and a map pin with the place name filled in automatically
- Live matching status on every report (analyzing, searching, N matches) pushed over WebSockets
- Match page: both photos as claim tags tied together, the score, and the reasons and differences the AI found; contact details are shared only after both owners confirm
- English and Hebrew with full right-to-left layout, light and dark themes, keyboard and screen-reader friendly
- Background AI matching pipeline: structured extraction, multimodal vector search, rule filter and photo-to-photo reranking with explanations
- Real-time notifications and 1:1 chat (Socket.IO namespaces)
- Match confirmation flow and resolved-item tracking
- JWT auth with refresh tokens and Google Sign-In
- Map of open reports (Leaflet + OpenStreetMap, no API key needed)
- REST API documented with Swagger (`/api-docs`), Jest integration tests

## Security

- **Identity only from the token.** Every write takes the user from the verified JWT, never from the request body, query or URL.
- **Ownership checks.** Only the users an item, match, notification or profile belongs to can read or change it. Contact details are shared only between users who have a match.
- **Authenticated sockets.** Both Socket.IO namespaces require an access token in the handshake. Chat rooms are limited to the two participants of a match, and the server sets sender and receiver.
- **Token hygiene.** Access tokens are short-lived and refresh tokens are typed and rotated. Reusing a revoked refresh token signs the user out everywhere.
- **Photo privacy.** Phone photos embed the GPS position where they were taken. Every upload is decoded, its format checked from the bytes (a renamed file or an SVG is rejected) and re-encoded to WebP at most 1600 px, with all EXIF and GPS metadata dropped, before it is stored in Cloudinary.
- **Input and transport.** Zod validation on every route, image-only uploads up to 5 MB, body size limits, helmet headers, a CORS allow-list, and rate limits on the auth and upload routes.
- **Observability.** Structured JSON logs (pino) with request ids. Credentials are redacted from logs, and error responses never leak internals.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, TypeScript (strict), Vite, Tailwind CSS v4, shadcn/ui (Radix), TanStack Query, React Router, React Hook Form + Zod, react-i18next (EN/HE, RTL), Leaflet, Socket.IO client |
| Backend | Node.js, Express, TypeScript, MongoDB + Mongoose, Socket.IO, Zod, pino, helmet, Multer, sharp, Cloudinary, Swagger |
| AI | Gemini (@google/genai): Flash-Lite extraction, Flash reranking, gemini-embedding-2; MongoDB Atlas Vector Search |
| Testing | Backend: Jest + Supertest, mongodb-memory-server, socket.io-client · Frontend: Vitest + Testing Library |
| DevOps | Docker (multi-stage images), Docker Compose, GitHub Actions CI, GitHub Container Registry |

## Project structure

```
backend/   Express API, matching pipeline (src/services), sockets, tests
frontend/  React SPA
```

## Running locally

### Quick start: no database, no API keys

```bash
cd backend && npm install && npm run dev:demo   # API on :3000: in-memory MongoDB, offline AI, demo world seeded
cd frontend && npm install && npm run dev                      # http://localhost:5173
```

`AI_FAKE=true` swaps Gemini for a deterministic offline matcher (word overlap and hashed embeddings), so you can try the full flow (report, match, chat) without any keys. It is refused in production.

### With Docker (recommended)

```bash
cp backend/.env.example backend/.env    # add GEMINI_API_KEY (matching is skipped without it)
docker compose up --build
```

| Service | URL |
|---|---|
| Frontend (nginx) | http://localhost:5173 |
| API | http://localhost:3000 |
| API docs (Swagger) | http://localhost:3000/api-docs |
| Health check | http://localhost:3000/health |

MongoDB data and uploaded images are kept in named Docker volumes.

### Without Docker

Prerequisites: Node.js 20+, MongoDB, and a Gemini API key from Google AI Studio (free tier). Locally, vector search runs in memory; production uses Atlas Vector Search with the index in `backend/atlas/vector-index.json`.

```bash
# backend
cd backend
cp .env.example .env      # fill in the keys
npm install
npm run dev               # http://localhost:3000
npm test                  # starts its own in-memory MongoDB; no database or API keys needed

# frontend
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

## CI/CD

Every push and pull request runs [GitHub Actions](.github/workflows/ci.yml):

1. **Backend:** ESLint, TypeScript type-check, and Jest unit, integration and socket tests against an in-memory MongoDB. Google AI services are mocked, so tests are deterministic and need no API keys.
2. **Frontend:** ESLint and a production build.
3. **Docker:** builds both images with layer caching. On `main`, images are pushed to GitHub Container Registry (`ghcr.io/nadavby/eureka-backend`, `ghcr.io/nadavby/eureka-frontend`), tagged `latest` and with the commit SHA.

The backend image is a multi-stage build: TypeScript is compiled in a build stage, and the runtime stage contains only production dependencies and compiled JS, runs as a non-root user and has a health check.

## Background

Eureka started as our B.Sc. final project at the College of Management Academic Studies (2025). I came up with the idea, led the team, designed the architecture and wrote most of the code. Development continues in this repository.
