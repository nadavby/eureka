# Eureka — AI-powered Lost & Found

[![CI](https://github.com/nadavby/eureka/actions/workflows/ci.yml/badge.svg)](https://github.com/nadavby/eureka/actions/workflows/ci.yml)

Eureka reunites people with lost items. Users report a **lost** or **found** item with a photo and location; the system analyzes the image with computer vision, then uses an LLM to decide whether a lost item and a found item are the same object, and notifies both owners in real time so they can chat and confirm the match.

## How matching works

```
upload photo ──► Google Cloud Vision ──► labels / objects / text / logos
                                              │
new item ──► candidate filter ────────────────┤   same category
             (cheap, deterministic)           │   found date ≥ lost date
                                              │   distance ≤ 8 km (haversine)
                                              ▼
                              Gemini evaluates each candidate pair
                              → { confidenceScore 0-100, reasoning } (JSON)
                                              │
                         score ≥ 70 ──► match saved ──► Socket.IO notification
                                                       ──► real-time chat ──► owners confirm
```

The deterministic filter runs first so that only plausible pairs reach the LLM. That keeps both latency and API cost down.

## Features

- Lost / found item reporting with photo upload, map location picker and item metadata (category, brand, colors, materials)
- Two-stage matching pipeline: Vision feature extraction, rule-based pre-filtering, LLM pair evaluation with structured JSON output
- Real-time notifications and 1:1 chat (Socket.IO namespaces)
- Match confirmation flow and resolved-item tracking
- JWT auth with refresh tokens and Google Sign-In
- Interactive map of lost items (Google Maps)
- REST API documented with Swagger (`/api-docs`), Jest integration tests

## Security

- **Identity only from the token.** Every write takes the user from the verified JWT, never from the request body, query or URL.
- **Ownership checks.** Only the users an item, match, notification or profile belongs to can read or change it. Contact details are shared only between users who have a match.
- **Authenticated sockets.** Both Socket.IO namespaces require an access token in the handshake. Chat rooms are limited to the two participants of a match, and the server sets sender and receiver.
- **Token hygiene.** Access tokens are short-lived and refresh tokens are typed and rotated. Reusing a revoked refresh token signs the user out everywhere.
- **Input and transport.** Zod validation on every route, image-only uploads up to 5 MB, body size limits, helmet headers, a CORS allow-list, and rate limits on the auth and upload routes.
- **Observability.** Structured JSON logs (pino) with request ids. Credentials are redacted from logs, and error responses never leak internals.

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, React Hook Form + Zod, Tailwind / Bootstrap, Google Maps |
| Backend | Node.js, Express, TypeScript, MongoDB + Mongoose, Socket.IO, Zod, pino, helmet, Multer, Swagger |
| AI | Google Cloud Vision API, Google Gemini |
| Testing | Jest + Supertest, mongodb-memory-server, socket.io-client |
| DevOps | Docker (multi-stage images), Docker Compose, GitHub Actions CI, GitHub Container Registry |

## Project structure

```
backend/   Express API, matching pipeline (src/services), sockets, tests
frontend/  React SPA
```

## Running locally

### With Docker (recommended)

```bash
cp backend/.env.example backend/.env    # add GEMINI_API_KEY and GOOGLE_CLOUD_VISION_API_KEY
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

Prerequisites: Node.js 20+, MongoDB, and Google Cloud API keys (Vision, Gemini, Maps).

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
