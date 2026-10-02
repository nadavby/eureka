# Eureka — AI-powered Lost & Found

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

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, React Hook Form + Zod, Tailwind / Bootstrap, Google Maps |
| Backend | Node.js, Express, TypeScript, MongoDB + Mongoose, Socket.IO, Multer, Swagger |
| AI | Google Cloud Vision API, Google Gemini |
| Testing | Jest + Supertest |

## Project structure

```
backend/   Express API, matching pipeline (src/services), sockets, tests
frontend/  React SPA
```

## Running locally

Prerequisites: Node.js 18+, MongoDB, and Google Cloud API keys (Vision, Gemini, Maps).

```bash
# backend
cd backend
cp .env.example .env      # fill in the keys
npm install
npm run dev               # http://localhost:3000, docs at /api-docs

# frontend
cd frontend
cp .env.example .env
npm install
npm run dev               # http://localhost:5173
```

Run the backend tests with `cd backend && npm test` (requires MongoDB).

## Background

Eureka started as our B.Sc. final project at the College of Management Academic Studies (2025). I came up with the idea, led the team, designed the architecture and wrote most of the code. Development continues in this repository.
