# Stage 1: Foundation & Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close every authorization hole in the Eureka backend and give it a production foundation: typed config, structured logging, consistent errors, validation, hardening. Existing behaviour stays compatible with the current frontend.

**Architecture:**
- New infrastructure goes under `backend/src/lib` (config, logger, errors, tokens) and `backend/src/middleware` (auth, validate, error handler, security).
- Identity comes from the JWT through `req.user`, never from the request body, query or params. Sockets authenticate with a JWT in the handshake.
- Controllers throw `AppError` and one error handler formats the responses.

**Tech Stack:** Express 4, TypeScript, Mongoose 8, Zod, pino / pino-http, helmet, express-rate-limit, Socket.IO 4, Jest + Supertest + socket.io-client.

Spec: `docs/specs/2026-10-07-production-upgrade-design.md` §1.

---

## Ground rules

- Run all backend commands from `backend/`.
- Tests need MongoDB. Locally run `docker run -d --name eureka-mongo -p 27017:27017 mongo:7` and set `DB_CONNECTION=mongodb://localhost:27017/eureka-test` in `backend/.env`.
- The test command is `npx jest --runInBand --forceExit <file>`, and the full suite is `npm test`.
- Error response shape everywhere is `{ "error": "<CODE>", "message": "<human text>" }`. The frontend already reads `response.data.message`.
- Commit after every task with the message given, ending with the `Co-Authored-By` trailer.

## File map

| File | Responsibility |
|---|---|
| `src/lib/config.ts` (new) | Load and validate env with Zod; export a typed `config` |
| `src/lib/logger.ts` (new) | pino logger plus the pino-http middleware |
| `src/lib/errors.ts` (new) | `AppError` and the `badRequest`/`unauthorized`/`forbidden`/`notFound`/`conflict` helpers |
| `src/lib/async-handler.ts` (new) | Wrap async route handlers so rejections reach the error handler |
| `src/lib/tokens.ts` (new) | Sign and verify access and refresh tokens |
| `src/types/express.d.ts` (new) | Add `req.user` to the Express `Request` type |
| `src/middleware/auth.ts` (new) | `requireAuth`, `optionalAuth` |
| `src/middleware/validate.ts` (new) | `validate({ body, query, params })` with Zod |
| `src/middleware/error-handler.ts` (new) | 404 and error-to-JSON mapping |
| `src/middleware/security.ts` (new) | helmet, CORS and the rate limiters |
| `src/middleware/upload.ts` (new) | multer: image-only files, 5 MB limit |
| `src/schemas/*.ts` (new) | Zod request schemas for each resource |
| `src/sockets/socket-auth.ts` (new) | Socket.IO JWT middleware |
| `src/controllers/*`, `src/routes/*`, `src/services/*socket*` | Use `req.user`, ownership checks, the logger |
| `src/models/user_model.ts`, `item_model.ts` | `toJSON` strips secrets and private fields |
| `frontend/src/services/*socket*.ts` | Send the JWT in the socket handshake |

---

### Task 0: Branch setup

- [ ] **Step 1:** Merge the green PR #1 (`feat/docker-ci`) into `main` on GitHub and pull it:

```bash
gh pr merge 1 -R nadavby/eureka --merge
git checkout main && git pull
git checkout -b stage1-foundation
git cherry-pick <spec commit> <plan commit>   # the docs commits from the local dev branch
```

- [ ] **Step 2:** Start Mongo and check that the baseline suite passes: `npm ci && npm test`. Expected: 83 tests pass.

### Task 1: Dependencies & cleanup

**Files:** `backend/package.json`, delete `src/tests/CommentsTestsItems/`, `src/tests/PostTestsItems/`.

- [ ] **Step 1:** Remove the unused and runtime-misplaced packages, then add the new ones:

```bash
npm uninstall openai opencv-wasm opencv.js body-parser nodemon ts-node typescript prettier @types/bcrypt @types/body-parser @types/express @types/jsonwebtoken @types/multer @types/swagger-jsdoc @types/swagger-ui-express
npm install zod pino pino-http helmet express-rate-limit
npm install -D typescript ts-node nodemon prettier pino-pretty socket.io-client @types/bcrypt @types/express@4 @types/jsonwebtoken @types/multer @types/swagger-jsdoc @types/swagger-ui-express
```

- [ ] **Step 2:** In `package.json`:
  - Set `"name": "eureka-backend"`.
  - Replace `scripts` with the block below.
  - Make sure `start` points at `dist/index.js`.

```json
"scripts": {
  "dev": "nodemon --exec ts-node ./src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "test": "jest --runInBand --forceExit --coverage"
}
```

- [ ] **Step 3:** Delete the leftover course fixtures:

```bash
git rm -r src/tests/CommentsTestsItems src/tests/PostTestsItems
```

- [ ] **Step 4:** Check the build: `npx tsc --noEmit`. Expected: no errors. Then `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit: `chore(backend): drop unused deps and leftover course fixtures`.

### Task 2: Typed config

**Files:** create `src/lib/config.ts` and `src/tests/config.test.ts`.

- [ ] **Step 1: Failing test**

```ts
// src/tests/config.test.ts
import { parseConfig } from "../lib/config";

const base = {
  DB_CONNECTION: "mongodb://localhost/x",
  TOKEN_SECRET: "a".repeat(32),
};

describe("parseConfig", () => {
  it("applies defaults", () => {
    const c = parseConfig({ ...base });
    expect(c.PORT).toBe(3000);
    expect(c.TOKEN_EXPIRATION).toBe("15m");
    expect(c.CLIENT_URLS).toEqual(["http://localhost:5173"]);
  });

  it("splits CLIENT_URL into a list", () => {
    const c = parseConfig({ ...base, CLIENT_URL: "https://a.com, https://b.com" });
    expect(c.CLIENT_URLS).toEqual(["https://a.com", "https://b.com"]);
  });

  it("rejects a missing or short TOKEN_SECRET", () => {
    expect(() => parseConfig({ DB_CONNECTION: "x" })).toThrow(/TOKEN_SECRET/);
    expect(() => parseConfig({ ...base, TOKEN_SECRET: "short" })).toThrow(/TOKEN_SECRET/);
  });
});
```

- [ ] **Step 2:** Run `npx jest config.test.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement**

```ts
// src/lib/config.ts
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DB_CONNECTION: z.string().min(1, "DB_CONNECTION is required"),
  DOMAIN_BASE: z.string().url().default("http://localhost:3000"),
  TOKEN_SECRET: z.string().min(32, "TOKEN_SECRET must be at least 32 characters"),
  TOKEN_EXPIRATION: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRATION: z.string().default("7d"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  GEMINI_API_KEY: z.string().default(""),
  GOOGLE_CLOUD_VISION_API_KEY: z.string().default(""),
  GOOGLE_CLIENT_ID: z.string().default(""),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
  SSL_KEY_PATH: z.string().optional(),
  SSL_CERT_PATH: z.string().optional(),
});

export type Config = z.infer<typeof schema> & { CLIENT_URLS: string[] };

export const parseConfig = (env: Record<string, string | undefined>): Config => {
  const result = schema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const CLIENT_URLS = result.data.CLIENT_URL.split(",").map((s) => s.trim()).filter(Boolean);
  return { ...result.data, CLIENT_URLS };
};

export const config = parseConfig(process.env);
```

- [ ] **Step 4:** Run `npx jest config.test.ts`. Expected: PASS.
- [ ] **Step 5:** Update the env files:
  - `.env.example`: set `TOKEN_SECRET=change-me-to-a-random-string-of-32-chars-or-more` and `TOKEN_EXPIRATION=15m`.
  - In `.github/workflows/ci.yml`, set `TOKEN_SECRET: ci-test-secret-ci-test-secret-ci-test-secret`.
- [ ] **Step 6:** Commit: `feat(backend): validate environment at boot with zod`.

### Task 3: Logger, errors, async handler, error middleware

**Files:**
- Create `src/lib/logger.ts`, `src/lib/errors.ts`, `src/lib/async-handler.ts` and `src/middleware/error-handler.ts`.
- Test in `src/tests/error-handler.test.ts`.

- [ ] **Step 1: Failing test**

```ts
// src/tests/error-handler.test.ts
import express from "express";
import request from "supertest";
import multer from "multer";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler";
import { forbidden } from "../lib/errors";
import { errorHandler, notFoundHandler } from "../middleware/error-handler";

const app = express();
app.get("/forbidden", asyncHandler(async () => { throw forbidden("Not yours"); }));
app.get("/zod", asyncHandler(async () => { z.object({ a: z.string() }).parse({}); }));
app.get("/boom", asyncHandler(async () => { throw new Error("secret internals"); }));
app.get("/multer", () => { throw new multer.MulterError("LIMIT_FILE_SIZE"); });
app.use(notFoundHandler);
app.use(errorHandler);

describe("errorHandler", () => {
  it("maps AppError", async () => {
    const res = await request(app).get("/forbidden");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: "FORBIDDEN", message: "Not yours" });
  });

  it("maps ZodError to 400 with details", async () => {
    const res = await request(app).get("/zod");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("VALIDATION_ERROR");
    expect(res.body.details[0].path).toEqual(["a"]);
  });

  it("hides internals on 500", async () => {
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "INTERNAL", message: "Something went wrong" });
  });

  it("maps file-too-large to 413", async () => {
    const res = await request(app).get("/multer");
    expect(res.status).toBe(413);
  });

  it("returns JSON 404 for unknown routes", async () => {
    const res = await request(app).get("/nope");
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("NOT_FOUND");
  });
});
```

- [ ] **Step 2:** Run `npx jest error-handler.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3: Implement**

```ts
// src/lib/logger.ts
import pino from "pino";
import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import { config } from "./config";

export const logger = pino({
  level: config.LOG_LEVEL ?? (config.NODE_ENV === "test" ? "silent" : "info"),
  redact: ["req.headers.authorization", "req.headers.cookie", "*.password", "*.refreshToken", "*.accessToken"],
  transport: config.NODE_ENV === "development" ? { target: "pino-pretty" } : undefined,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = (req.headers["x-request-id"] as string) || randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },
  autoLogging: { ignore: (req) => req.url === "/health" },
});
```

```ts
// src/lib/errors.ts
export class AppError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export const badRequest = (message = "Bad request") => new AppError(400, "BAD_REQUEST", message);
export const unauthorized = (message = "Unauthorized") => new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Forbidden") => new AppError(403, "FORBIDDEN", message);
export const notFound = (message = "Not found") => new AppError(404, "NOT_FOUND", message);
export const conflict = (message = "Conflict") => new AppError(409, "CONFLICT", message);
```

```ts
// src/lib/async-handler.ts
import { NextFunction, Request, RequestHandler, Response } from "express";

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
```

```ts
// src/middleware/error-handler.ts
import { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Invalid request",
      details: err.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: "BAD_REQUEST", message: `Invalid ${err.path}` });
    return;
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    res.status(status).json({ error: err.code, message: err.message });
    return;
  }
  if (err?.type === "entity.too.large") {
    res.status(413).json({ error: "PAYLOAD_TOO_LARGE", message: "Request body too large" });
    return;
  }
  (req.log ?? logger).error({ err }, "Unhandled error");
  res.status(500).json({ error: "INTERNAL", message: "Something went wrong" });
};
```

- [ ] **Step 4:** Run `npx jest error-handler.test.ts`. Expected: PASS (5 tests).
- [ ] **Step 5:** Commit: `feat(backend): structured logging and consistent JSON errors`.

### Task 4: Tokens + auth middleware + `req.user`

**Files:**
- Create `src/lib/tokens.ts`, `src/types/express.d.ts` and `src/middleware/auth.ts`.
- Modify `src/controllers/auth_controller.ts` and `tsconfig.json`.
- Test in `src/tests/auth-middleware.test.ts`.

- [ ] **Step 1: Failing test**

```ts
// src/tests/auth-middleware.test.ts
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { config } from "../lib/config";
import { signAccessToken } from "../lib/tokens";
import { optionalAuth, requireAuth } from "../middleware/auth";
import { errorHandler } from "../middleware/error-handler";

const app = express();
app.get("/private", requireAuth, (req, res) => { res.json({ id: req.user!.id }); });
app.get("/public", optionalAuth, (req, res) => { res.json({ id: req.user?.id ?? null }); });
app.use(errorHandler);

describe("auth middleware", () => {
  it("accepts Bearer and JWT prefixes", async () => {
    const token = signAccessToken("u1");
    for (const prefix of ["Bearer", "JWT"]) {
      const res = await request(app).get("/private").set("Authorization", `${prefix} ${token}`);
      expect(res.body).toEqual({ id: "u1" });
    }
  });

  it("rejects missing, malformed and expired tokens with 401", async () => {
    const expired = jwt.sign({ _id: "u1" }, config.TOKEN_SECRET, { expiresIn: -10 });
    expect((await request(app).get("/private")).status).toBe(401);
    expect((await request(app).get("/private").set("Authorization", "Bearer nope")).status).toBe(401);
    const res = await request(app).get("/private").set("Authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe("TOKEN_EXPIRED");
  });

  it("rejects a refresh token used as an access token", async () => {
    const refresh = jwt.sign({ _id: "u1", typ: "refresh" }, config.TOKEN_SECRET);
    const res = await request(app).get("/private").set("Authorization", `Bearer ${refresh}`);
    expect(res.status).toBe(401);
  });

  it("optionalAuth never fails", async () => {
    expect((await request(app).get("/public")).body).toEqual({ id: null });
    const res = await request(app).get("/public").set("Authorization", "Bearer junk");
    expect(res.body).toEqual({ id: null });
  });
});
```

- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
// src/types/express.d.ts
import "express";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string };
    }
  }
}
export {};
```

In `tsconfig.json`, add `"files": ["src/types/express.d.ts"]` next to `include`, so ts-node and ts-jest pick it up.

```ts
// src/lib/tokens.ts
import jwt, { JwtPayload } from "jsonwebtoken";
import { randomUUID } from "crypto";
import { config } from "./config";

type TokenType = "access" | "refresh";
interface Claims extends JwtPayload { _id: string; typ: TokenType }

const sign = (userId: string, typ: TokenType, expiresIn: string) =>
  jwt.sign({ _id: userId, typ }, config.TOKEN_SECRET, {
    expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    jwtid: randomUUID(),
  });

export const signAccessToken = (userId: string) => sign(userId, "access", config.TOKEN_EXPIRATION);
export const signRefreshToken = (userId: string) => sign(userId, "refresh", config.REFRESH_TOKEN_EXPIRATION);

export const issueTokens = (userId: string) => ({
  accessToken: signAccessToken(userId),
  refreshToken: signRefreshToken(userId),
});

/** Throws jsonwebtoken errors (TokenExpiredError / JsonWebTokenError) or Error("wrong token type"). */
export const verifyToken = (token: string, typ: TokenType): string => {
  const payload = jwt.verify(token, config.TOKEN_SECRET) as Claims;
  if (payload.typ !== typ || typeof payload._id !== "string") throw new Error("wrong token type");
  return payload._id;
};
```

```ts
// src/middleware/auth.ts
import { RequestHandler } from "express";
import { TokenExpiredError } from "jsonwebtoken";
import { AppError, unauthorized } from "../lib/errors";
import { verifyToken } from "../lib/tokens";

const extractToken = (header?: string): string | null => {
  if (!header) return null;
  const [prefix, token] = header.split(" ");
  if ((prefix !== "Bearer" && prefix !== "JWT") || !token) return null;
  return token;
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req.header("authorization"));
  if (!token) return next(unauthorized("Missing or malformed Authorization header"));
  try {
    req.user = { id: verifyToken(token, "access") };
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) return next(new AppError(401, "TOKEN_EXPIRED", "Access token expired"));
    next(unauthorized("Invalid token"));
  }
};

export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = extractToken(req.header("authorization"));
  if (token) {
    try {
      req.user = { id: verifyToken(token, "access") };
    } catch {
      /* anonymous */
    }
  }
  next();
};
```

- [ ] **Step 4:** In `auth_controller.ts`:
  - Delete `generateToken` and the old `authMiddleware`, including the refresh-via-header branch. The frontend already refreshes through `/auth/refresh` on a 401.
  - Use `issueTokens(user._id.toString())` everywhere.
  - In `refresh` and `logout`, replace `jwt.verify(refreshToken, …)` with `verifyToken(refreshToken, "refresh")` inside try/catch.
  - Change refresh's `402` to `401`.
- [ ] **Step 5:** Update the imports in `routes/item_routes.ts`, `match_routes.ts` and `notification_routes.ts`: `import { requireAuth } from "../middleware/auth"` instead of `authMiddleware`.
- [ ] **Step 6:** Run `npx jest auth-middleware.test.ts` (expected: PASS), then `npm test` to see what breaks. Update `auth.test.ts` wherever it expected the old behaviour: refresh reuse now returns 401, not 402. Expected: all PASS.
- [ ] **Step 7:** Commit: `feat(backend): typed req.user, access/refresh token types, single auth middleware`.

### Task 5: Validation middleware + schemas

**Files:**
- Create `src/middleware/validate.ts`, `src/schemas/auth.schema.ts`, `src/schemas/item.schema.ts`, `src/schemas/match.schema.ts` and `src/schemas/common.ts`.
- Test in `src/tests/validate.test.ts`.

- [ ] **Step 1: Failing test**

```ts
// src/tests/validate.test.ts
import express from "express";
import request from "supertest";
import { z } from "zod";
import { validate } from "../middleware/validate";
import { errorHandler } from "../middleware/error-handler";
import { objectId } from "../schemas/common";

const app = express();
app.use(express.json());
app.post(
  "/x/:id",
  validate({ params: z.object({ id: objectId }), body: z.object({ n: z.coerce.number().max(5) }).strict() }),
  (req, res) => { res.json({ body: req.body, id: req.params.id }); }
);
app.use(errorHandler);

describe("validate", () => {
  it("passes parsed values through", async () => {
    const res = await request(app).post("/x/507f1f77bcf86cd799439011").send({ n: "3" });
    expect(res.body).toEqual({ body: { n: 3 }, id: "507f1f77bcf86cd799439011" });
  });

  it("rejects bad ids, bad values and unknown keys", async () => {
    expect((await request(app).post("/x/123").send({ n: 1 })).status).toBe(400);
    expect((await request(app).post("/x/507f1f77bcf86cd799439011").send({ n: 9 })).status).toBe(400);
    expect((await request(app).post("/x/507f1f77bcf86cd799439011").send({ n: 1, userId: "evil" })).status).toBe(400);
  });
});
```

- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3: Implement**

```ts
// src/middleware/validate.ts
import { RequestHandler } from "express";
import { ZodTypeAny } from "zod";

type Schemas = { body?: ZodTypeAny; query?: ZodTypeAny; params?: ZodTypeAny };

export const validate = (schemas: Schemas): RequestHandler => (req, _res, next) => {
  try {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.query) Object.assign(req.query, schemas.query.parse(req.query));
    if (schemas.body) req.body = schemas.body.parse(req.body);
    next();
  } catch (err) {
    next(err);
  }
};
```

```ts
// src/schemas/common.ts
import { z } from "zod";
export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
export const idParams = z.object({ id: objectId });
```

```ts
// src/schemas/auth.schema.ts
import { z } from "zod";

const password = z.string().min(8, "Password must be at least 8 characters").max(128);
const userName = z.string().trim().min(2).max(40);
const phoneNumber = z.string().trim().max(20);

export const registerBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password,
  userName,
  phoneNumber,
  imgURL: z.string().url().nullish(),
});

export const loginBody = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });
export const refreshBody = z.object({ refreshToken: z.string().min(1) });
export const googleBody = z.object({ credential: z.string().min(1) });

export const updateUserBody = z
  .object({ userName, phoneNumber, imgURL: z.string().url().nullable(), password })
  .partial()
  .strict();
```

```ts
// src/schemas/item.schema.ts
import { z } from "zod";

// multipart fields arrive as strings; location arrives as a JSON string
const location = z.preprocess(
  (v) => (typeof v === "string" ? JSON.parse(v) : v),
  z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
);
const colors = z.preprocess(
  (v) => (typeof v === "string" ? v.split(",").map((s) => s.trim()).filter(Boolean) : v),
  z.array(z.string().max(30)).max(10)
);

export const createItemBody = z.object({
  itemType: z.string().toLowerCase().pipe(z.enum(["lost", "found"])),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().max(60).optional(),
  date: z.coerce.date().optional(),
  location: location.optional(),
  colors: colors.optional(),
  brand: z.string().trim().max(60).optional(),
  condition: z.enum(["new", "worn", "damaged", "other"]).optional(),
  flaws: z.string().trim().max(500).optional(),
  material: z.string().trim().max(60).optional(),
});

export const listItemsQuery = z.object({
  itemType: z.enum(["lost", "found"]).optional(),
  userId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});
```

`createItemBody` is deliberately **not** `.strict()`. Legacy clients send `userId`, `name` and `kind`. Unknown keys are stripped, which is how a client-supplied `userId` gets dropped.

```ts
// src/schemas/match.schema.ts
import { z } from "zod";
import { objectId } from "./common";
// userId is accepted for backwards compatibility but ignored: identity comes from the JWT
export const confirmMatchBody = z.object({ matchId: objectId, userId: z.string().optional() });
export const userIdParams = z.object({ userId: objectId });
```

- [ ] **Step 4:** Run `npx jest validate.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(backend): zod request validation middleware and schemas`.

### Task 6: Users: no data leaks, self-only writes

**Files:**
- Modify `src/models/user_model.ts`, `src/controllers/auth_controller.ts` and `src/routes/auth_routes.ts`.
- Add tests to the new `src/tests/security.users.test.ts`.

Behaviour:
- `toJSON` never returns `password`, `refreshToken` or `__v`.
- `GET /auth` (the list of all users) is **removed**; the frontend never renders it.
- `GET /auth/:id` uses `optionalAuth`:
  - For the requester themself, or a user who shares a match with them, it returns the full profile (email, phone).
  - Otherwise it returns `{ _id, userName, imgURL }` only.
- `PUT /auth/:id` and `DELETE /auth/:id` need `requireAuth` plus `req.user.id === :id`; otherwise 403.
- The login and Google responses keep their current shape.

- [ ] **Step 1: Failing tests**

```ts
// src/tests/security.users.test.ts
import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import initApp from "../server";
import userModel from "../models/user_model";
import matchModel from "../models/match_model";

let app: Express;
const mk = async (n: string) => {
  const email = `${n}@sec-users.test`;
  await request(app).post("/auth/register").send({ email, password: "password123", userName: n, phoneNumber: "+972500000000" });
  const res = await request(app).post("/auth/login").send({ email, password: "password123" });
  return { id: res.body._id as string, token: res.body.accessToken as string };
};
let a: { id: string; token: string }, b: typeof a, c: typeof a;

beforeAll(async () => {
  app = await initApp();
  await userModel.deleteMany({ email: /@sec-users\.test$/ });
  [a, b, c] = [await mk("alice"), await mk("bob"), await mk("carol")];
  await matchModel.create({ item1Id: "i1", userId1: a.id, item2Id: "i2", userId2: b.id, matchScore: 90 });
});
afterAll(async () => {
  await matchModel.deleteMany({ userId1: a.id });
  await userModel.deleteMany({ email: /@sec-users\.test$/ });
  await mongoose.connection.close();
});

describe("user privacy", () => {
  it("register response never contains the password hash", async () => {
    const res = await request(app).post("/auth/register")
      .send({ email: "dave@sec-users.test", password: "password123", userName: "dave", phoneNumber: "1" });
    expect(res.status).toBe(200);
    expect(res.body.password).toBeUndefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  it("GET /auth (list all users) no longer exists", async () => {
    expect((await request(app).get("/auth")).status).toBe(404);
  });

  it("strangers see only the public profile", async () => {
    const res = await request(app).get(`/auth/${a.id}`).set("Authorization", `Bearer ${c.token}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(["_id", "imgURL", "userName"].filter((k) => k in res.body).sort());
    expect(res.body.email).toBeUndefined();
    expect(res.body.phoneNumber).toBeUndefined();
  });

  it("matched users and self see contact details", async () => {
    const asMatch = await request(app).get(`/auth/${a.id}`).set("Authorization", `Bearer ${b.token}`);
    expect(asMatch.body.email).toBe("alice@sec-users.test");
    const self = await request(app).get(`/auth/${a.id}`).set("Authorization", `Bearer ${a.token}`);
    expect(self.body.phoneNumber).toBe("+972500000000");
    expect(self.body.password).toBeUndefined();
  });

  it("cannot update or delete another user", async () => {
    expect((await request(app).put(`/auth/${a.id}`).send({ userName: "x" })).status).toBe(401);
    expect((await request(app).put(`/auth/${a.id}`).set("Authorization", `Bearer ${c.token}`).send({ userName: "x" })).status).toBe(403);
    expect((await request(app).delete(`/auth/${a.id}`).set("Authorization", `Bearer ${c.token}`)).status).toBe(403);
  });

  it("cannot set arbitrary fields such as refreshToken or email via update", async () => {
    const res = await request(app).put(`/auth/${a.id}`).set("Authorization", `Bearer ${a.token}`).send({ refreshToken: ["x"] });
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2:** Run it. Expected: several FAILs.
- [ ] **Step 3: Implement**
  - In `user_model.ts`, after the schema definition:

```ts
userSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.__v;
    return ret;
  },
});
```

  - In `auth_controller.ts`, replace `getUserById`, `updateUser`, `deleteUser` and `register`, and delete `getAllUsers`:

```ts
const sharesMatch = async (a: string, b: string) =>
  !!(await matchModel.exists({ $or: [{ userId1: a, userId2: b }, { userId1: b, userId2: a }] }));

const getUserById = async (req: Request, res: Response) => {
  const user = await userModel.findById(req.params.id);
  if (!user) throw notFound("User not found");
  const viewer = req.user?.id;
  const canSeeContact = !!viewer && (viewer === req.params.id || (await sharesMatch(viewer, req.params.id)));
  if (canSeeContact) return res.json(user);
  return res.json({ _id: user._id, userName: user.userName, imgURL: user.imgURL });
};

const updateUser = async (req: Request, res: Response) => {
  if (req.user!.id !== req.params.id) throw forbidden("You can only edit your own profile");
  const update = { ...req.body };
  if (update.password) update.password = await bcrypt.hash(update.password, 10);
  if (update.userName && (await userModel.exists({ userName: update.userName, _id: { $ne: req.params.id } }))) {
    throw conflict("User name already exists");
  }
  const user = await userModel.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!user) throw notFound("User not found");
  res.json(user);
};

const deleteUser = async (req: Request, res: Response) => {
  if (req.user!.id !== req.params.id) throw forbidden("You can only delete your own account");
  const user = await userModel.findByIdAndDelete(req.params.id);
  if (!user) throw notFound("User not found");
  res.json({ message: "User deleted" });
};

const register = async (req: Request, res: Response) => {
  const { email, password, userName, phoneNumber, imgURL } = req.body;
  if (await userModel.exists({ userName })) throw conflict("User name already exists");
  if (await userModel.exists({ email })) throw conflict("email already exists");
  const user = await userModel.create({
    email, userName, phoneNumber, imgURL: imgURL ?? null,
    password: await bcrypt.hash(password, 10),
  });
  res.status(200).json(user);
};
```

  - Convert `login`, `logout`, `refresh` and `googleSignIn` to throw `AppError`s. Wrong credentials return `401 INVALID_CREDENTIALS` with the message "Email or password incorrect"; previously this was 404. Remove both `console.log(user.refreshToken)` lines.
  - In `routes/auth_routes.ts`, keep the swagger blocks but update `/auth` GET (delete its block). Wire the routes:

```ts
router.post("/register", authLimiter, validate({ body: registerBody }), asyncHandler(authController.register));
router.post("/google", authLimiter, validate({ body: googleBody }), asyncHandler(authController.googleSignIn));
router.post("/login", authLimiter, validate({ body: loginBody }), asyncHandler(authController.login));
router.post("/refresh", authLimiter, validate({ body: refreshBody }), asyncHandler(authController.refresh));
router.post("/logout", validate({ body: refreshBody }), asyncHandler(authController.logout));
router.get("/:id", optionalAuth, validate({ params: idParams }), asyncHandler(authController.getUserById));
router.put("/:id", requireAuth, validate({ params: idParams, body: updateUserBody }), asyncHandler(authController.updateUser));
router.delete("/:id", requireAuth, validate({ params: idParams }), asyncHandler(authController.deleteUser));
```

  `authLimiter` comes from Task 9. Until then, create `src/middleware/security.ts` with a pass-through `export const authLimiter: RequestHandler = (_q, _s, n) => n();`.
  - In `server.ts`, mount `notFoundHandler` and then `errorHandler` after the routes, and `httpLogger` first.
- [ ] **Step 4:** Update `auth.test.ts`:
  - Expect 401 for bad credentials (it was 404).
  - Remove the `GET /auth` test.
  - Use 8+ character passwords.
  - Make the update and delete tests send the user's own token.

  Run `npm test`. Expected: all PASS.
- [ ] **Step 5:** In `frontend/src/components/UserProfile` and `PublicUserProfile`, nothing changes: the components already treat `email` and `phoneNumber` as optional. Check with `grep -n "getAllUsers" frontend/src -r`, which should find only `user-service.ts`. Delete that unused function.
- [ ] **Step 6:** Commit: `fix(security): stop leaking password hashes and contact details; self-only profile writes`.

### Task 7: Items: identity from JWT, ownership, safe uploads, private owner email

**Files:**
- Create `src/middleware/upload.ts`.
- Modify `src/routes/item_routes.ts`, `src/controllers/item_controller.ts` and `src/models/item_model.ts`.
- Test in `src/tests/security.items.test.ts`.

Behaviour:
- `POST /items` uses `req.user.id`; a body `userId` is ignored.
- Uploads must be `image/jpeg|png|webp|gif|heic` and at most 5 MB.
- `DELETE /items/:id` by a non-owner returns 403.
- Public `GET /items` and `GET /items/:id` responses never include `ownerEmail`.

- [ ] **Step 1: Failing tests**

```ts
// src/tests/security.items.test.ts
import request from "supertest";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";
import os from "os";
import { Express } from "express";
import initApp from "../server";
import userModel from "../models/user_model";
import itemModel from "../models/item_model";
import visionService from "../services/vision-service";
import geminiService from "../services/gemini-service";
import { itemFields, postItem, listUploadedItemFiles, removeNewUploadedItemFiles } from "./test_utils";

jest.mock("../services/vision-service", () => ({ __esModule: true, default: { getImageAnalysis: jest.fn() } }));
jest.mock("../services/gemini-service", () => ({ __esModule: true, default: { evaluateMatch: jest.fn() } }));

let app: Express;
let before: string[];
const mk = async (n: string) => {
  const email = `${n}@sec-items.test`;
  await request(app).post("/auth/register").send({ email, password: "password123", userName: n, phoneNumber: "1" });
  const res = await request(app).post("/auth/login").send({ email, password: "password123" });
  return { id: res.body._id as string, token: res.body.accessToken as string };
};
let a: { id: string; token: string }, b: typeof a;

beforeAll(async () => {
  app = await initApp();
  before = listUploadedItemFiles();
  (visionService.getImageAnalysis as jest.Mock).mockResolvedValue({ labels: [], objects: [], texts: [], logos: [] });
  (geminiService.evaluateMatch as jest.Mock).mockResolvedValue({ confidenceScore: 0, reasoning: "" });
  await userModel.deleteMany({ email: /@sec-items\.test$/ });
  [a, b] = [await mk("itemsA"), await mk("itemsB")];
});
afterAll(async () => {
  await itemModel.deleteMany({ userId: { $in: [a.id, b.id] } });
  await userModel.deleteMany({ email: /@sec-items\.test$/ });
  removeNewUploadedItemFiles(before);
  await mongoose.connection.close();
});

describe("item security", () => {
  it("ignores a client-supplied userId", async () => {
    const res = await postItem(app, a.token, { ...itemFields({ category: "SecCat" }), userId: b.id } as never);
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(a.id);
  });

  it("rejects non-image uploads", async () => {
    const txt = path.join(os.tmpdir(), "not-an-image.txt");
    fs.writeFileSync(txt, "hello");
    const res = await request(app).post("/items").set("Authorization", `Bearer ${a.token}`)
      .field("itemType", "lost").attach("image", txt);
    expect(res.status).toBe(400);
  });

  it("rejects files over 5 MB", async () => {
    const big = path.join(os.tmpdir(), "big.png");
    fs.writeFileSync(big, Buffer.alloc(6 * 1024 * 1024));
    const res = await request(app).post("/items").set("Authorization", `Bearer ${a.token}`)
      .field("itemType", "lost").attach("image", big, { contentType: "image/png" });
    expect(res.status).toBe(413);
  });

  it("does not expose ownerEmail publicly", async () => {
    const res = await request(app).get(`/items?userId=${a.id}`);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0].ownerEmail).toBeUndefined();
  });

  it("only the owner can delete an item", async () => {
    const item = await itemModel.findOne({ userId: a.id });
    const asB = await request(app).delete(`/items/${item!._id}`).set("Authorization", `Bearer ${b.token}`);
    expect(asB.status).toBe(403);
    const asA = await request(app).delete(`/items/${item!._id}`).set("Authorization", `Bearer ${a.token}`);
    expect(asA.status).toBe(200);
  });
});
```

`ItemFields` in `test_utils.ts` gets an optional `userId?: string`, so the cast becomes unnecessary; remove `as never` once it's added.

- [ ] **Step 2:** Run it. Expected: FAILs on userId, MIME, 413, ownerEmail and 403.
- [ ] **Step 3: Implement**

```ts
// src/middleware/upload.ts
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import { badRequest } from "../lib/errors";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"]);
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const imageUpload = (folder: "items" | "users") =>
  multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, path.join("public", folder)),
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
    }),
    limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
    fileFilter: (_req, file, cb) =>
      IMAGE_TYPES.has(file.mimetype) ? cb(null, true) : cb(badRequest("Only image uploads are allowed")),
  });
```

  - In `item_model.ts`, add a `toJSON` transform that deletes `ownerEmail` and `__v`. `ownerEmail` is still stored, because the matching notifications use it on the server.
  - Replace the `POST /items` route body in `item_routes.ts`:

```ts
const upload = imageUpload("items").fields([{ name: "file", maxCount: 1 }, { name: "image", maxCount: 1 }]);

router.post(
  "/",
  requireAuth,
  uploadLimiter,
  upload,
  (req, _res, next) => {
    // legacy clients send `kind` instead of `itemType` and `name` instead of `description`
    if (!req.body.itemType && req.body.kind) req.body.itemType = req.body.kind;
    if (!req.body.description && req.body.name) req.body.description = req.body.name;
    next();
  },
  validate({ body: createItemBody }),
  asyncHandler(uploadItem)
);
router.get("/", validate({ query: listItemsQuery }), asyncHandler(getAllItems));
router.get("/:id", validate({ params: idParams }), asyncHandler(getItemById));
router.delete("/:id", requireAuth, validate({ params: idParams }), asyncHandler(deleteItem));
```

  `uploadLimiter` comes from `middleware/security.ts`; add a pass-through stub until Task 9.
  - Rewrite `uploadItem` in `item_controller.ts`:
    - Read the file from `req.files`; with no file, throw `badRequest("Missing image: upload it as 'file' or 'image'")`.
    - `imageUrl = \`${config.DOMAIN_BASE}/public/items/${file.filename}\``.
    - `userId = req.user!.id`, and load the user with `userModel.findById(userId)`. If the user isn't found, throw `unauthorized()`.
    - Build `newItem` from the parsed `req.body`, which is already validated.
    - Keep the vision → match → notify flow as it is (stage 2 rewrites it), but replace the `res.status(400).send("Error"); return;` branches inside the loop with `throw new Error("Failed to persist match")`.
    - Respond with `res.status(201).json(savedItem)`. Previously it returned `newItem`, which has no `_id`.
  - Rewrite `deleteItem`:

```ts
const deleteItem = async (req: Request, res: Response) => {
  const item = await itemModel.findById(req.params.id);
  if (!item) throw notFound("Item not found");
  if (item.userId !== req.user!.id) throw forbidden("You can only delete your own items");
  const matches = await matchModel.find({ $or: [{ item1Id: req.params.id }, { item2Id: req.params.id }] }, { _id: 1 });
  const matchIds = matches.map((m) => m._id.toString());
  await notificationModel.deleteMany({ matchId: { $in: matchIds } });
  await chatModel.deleteMany({ matchId: { $in: matchIds } });
  await matchModel.deleteMany({ _id: { $in: matchIds } });
  await item.deleteOne();
  res.json({ message: "Item deleted successfully" });
};
```

  - `getAllItems` and `getItemById` throw `notFound`, and drop their try/catch blocks.
- [ ] **Step 4:** Remove the old `multer.diskStorage` and `base` code from `item_routes.ts`. Then:
  - Run `npm test`. Expected: all PASS.
  - Fix `item.test.ts` assertions that relied on the old text responses. A missing file now returns `{error,message}` JSON with status 400.
- [ ] **Step 5:** Commit: `fix(security): items take identity from the JWT, enforce ownership and image-only uploads`.

### Task 8: Matches & notifications: participants only

**Files:**
- Modify `src/controllers/match_controller.ts`, `src/controllers/notification_controller.ts`, `src/routes/match_routes.ts` and `src/routes/notification_routes.ts`.
- Test in `src/tests/security.matches.test.ts`.

Behaviour:
- `GET /match/user/:userId` returns 403 unless `:userId === req.user.id`.
- `GET` and `DELETE /match/:id` return 403 unless the user is a participant.
- `POST /match/confirm` uses `req.user.id`, and notifications are deleted only after authorization.
- Notifications are always scoped to `{ userId: req.user.id }`. Another user's notification returns 404, so its existence isn't revealed.

- [ ] **Step 1: Failing tests**

```ts
// src/tests/security.matches.test.ts
import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import initApp from "../server";
import userModel from "../models/user_model";
import matchModel from "../models/match_model";
import notificationModel from "../models/notification_model";

let app: Express;
const mk = async (n: string) => {
  const email = `${n}@sec-match.test`;
  await request(app).post("/auth/register").send({ email, password: "password123", userName: n, phoneNumber: "1" });
  const res = await request(app).post("/auth/login").send({ email, password: "password123" });
  return { id: res.body._id as string, token: res.body.accessToken as string };
};
let a: { id: string; token: string }, b: typeof a, c: typeof a;
let matchId: string, notifId: string;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  app = await initApp();
  await userModel.deleteMany({ email: /@sec-match\.test$/ });
  [a, b, c] = [await mk("mA"), await mk("mB"), await mk("mC")];
  const m = await matchModel.create({ item1Id: "x1", userId1: a.id, item2Id: "x2", userId2: b.id, matchScore: 88 });
  matchId = m._id.toString();
  const n = await notificationModel.create({ userId: a.id, matchId, type: "MATCH_FOUND", title: "t", message: "m" });
  notifId = n._id.toString();
});
afterAll(async () => {
  await notificationModel.deleteMany({ matchId });
  await matchModel.deleteMany({ _id: matchId });
  await userModel.deleteMany({ email: /@sec-match\.test$/ });
  await mongoose.connection.close();
});

describe("match authorization", () => {
  it("cannot list another user's matches", async () => {
    expect((await request(app).get(`/match/user/${a.id}`).set(auth(c.token))).status).toBe(403);
    expect((await request(app).get(`/match/user/${a.id}`).set(auth(a.token))).status).toBe(200);
  });

  it("non-participants cannot read, confirm or delete a match", async () => {
    expect((await request(app).get(`/match/${matchId}`).set(auth(c.token))).status).toBe(403);
    expect((await request(app).post("/match/confirm").set(auth(c.token)).send({ matchId, userId: a.id })).status).toBe(403);
    expect((await request(app).delete(`/match/${matchId}`).set(auth(c.token))).status).toBe(403);
    // the failed confirm must not have deleted anyone's notifications
    expect(await notificationModel.countDocuments({ matchId })).toBe(1);
  });

  it("confirm uses the token identity, not the body", async () => {
    const res = await request(app).post("/match/confirm").set(auth(b.token)).send({ matchId, userId: a.id });
    expect(res.status).toBe(200);
    expect(res.body.userConfirmed).toBe("user2");
  });
});

describe("notification authorization", () => {
  it("lists only my notifications regardless of the query string", async () => {
    const res = await request(app).get(`/notification?userId=${a.id}`).set(auth(c.token));
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it("cannot read, mark or delete another user's notification", async () => {
    expect((await request(app).get(`/notification/${notifId}`).set(auth(c.token))).status).toBe(404);
    expect((await request(app).put(`/notification/${notifId}/read`).set(auth(c.token))).status).toBe(404);
    expect((await request(app).delete(`/notification/${notifId}`).set(auth(c.token))).status).toBe(404);
    expect((await request(app).get(`/notification/${notifId}`).set(auth(a.token))).status).toBe(200);
  });
});
```

The confirm test deletes the notifications for that match because confirm clears them. Run the notification describe block first: put it above the match block in the file.

- [ ] **Step 2:** Run it. Expected: FAILs.
- [ ] **Step 3: Implement**
  - In `match_controller.ts`:

```ts
const isParticipant = (m: { userId1: string; userId2: string }, userId: string) =>
  m.userId1 === userId || m.userId2 === userId;

const loadOwnMatch = async (matchId: string, userId: string) => {
  const match = await matchModel.findById(matchId);
  if (!match) throw notFound("Match not found");
  if (!isParticipant(match, userId)) throw forbidden("You are not part of this match");
  return match;
};

const getAllByUserId = async (req: Request, res: Response) => {
  if (req.params.userId !== req.user!.id) throw forbidden("You can only list your own matches");
  res.json(await matchModel.find({ $or: [{ userId1: req.user!.id }, { userId2: req.user!.id }] }));
};

const getById = async (req: Request, res: Response) => {
  res.json(await loadOwnMatch(req.params.id, req.user!.id));
};

const deleteById = async (req: Request, res: Response) => {
  const match = await loadOwnMatch(req.params.id, req.user!.id);
  await notificationModel.deleteMany({ matchId: match._id.toString() });
  await chatModel.deleteMany({ matchId: match._id.toString() });
  await match.deleteOne();
  res.json({ message: "Match and associated notifications deleted successfully" });
};
```

  - In `confirmMatch`:
    - Set `const userId = req.user!.id; const { matchId } = req.body;`.
    - Call `const match = await loadOwnMatch(matchId, userId);` before any delete.
    - Then delete the notifications and keep the rest of the existing logic.
    - Fix the final cleanup query to `{ $or: [{ item1Id: { $in: ids } }, { item2Id: { $in: ids } }] }`, where `ids = [match.item1Id, match.item2Id]`.
    - Delete the notification cleanup query that filtered on non-existent `item1Id`/`item2Id` fields.
  - In `notification_controller.ts`, every query includes `userId: req.user!.id`: `find({ userId })`, `findOne({ _id, userId })`, `findOneAndDelete({ _id, userId })`, `findOneAndUpdate({ _id, userId }, …)`, and `updateMany({ userId, isRead: false })`. A null result throws `notFound("Notification not found")`. Delete the unused `DeleteAllByUserId`.
  - Routes:

```ts
// match_routes.ts
router.get("/user/:userId", requireAuth, validate({ params: userIdParams }), asyncHandler(matchController.getAllByUserId));
router.post("/confirm", requireAuth, validate({ body: confirmMatchBody }), asyncHandler(matchController.confirmMatch));
router.get("/:id", requireAuth, validate({ params: idParams }), asyncHandler(matchController.getById));
router.delete("/:id", requireAuth, validate({ params: idParams }), asyncHandler(matchController.deleteById));

// notification_routes.ts ("read-all" before ":id" routes)
router.get("/", requireAuth, asyncHandler(notificationController.getAllByUserId));
router.put("/read-all", requireAuth, asyncHandler(notificationController.markAllAsRead));
router.get("/:id", requireAuth, validate({ params: idParams }), asyncHandler(notificationController.getById));
router.put("/:id/read", requireAuth, validate({ params: idParams }), asyncHandler(notificationController.markAsRead));
router.delete("/:id", requireAuth, validate({ params: idParams }), asyncHandler(notificationController.deleteById));
```

- [ ] **Step 4:** Run `npm test`. Expected: all PASS. Update `match.test.ts` wherever it used another user's token or ids: it should now expect 403.
- [ ] **Step 5:** Add swagger JSDoc blocks for all 4 match routes and 5 notification routes, in the same style as `item_routes.ts`: tags `Matches` / `Notifications`, `bearerAuth`, and 401/403/404 responses. Add a `bearerAuth` security scheme in `server.ts` under `components.securitySchemes` (`type: http, scheme: bearer, bearerFormat: JWT`).
- [ ] **Step 6:** Commit: `fix(security): matches and notifications are visible only to their participants`.

### Task 9: Security middleware (helmet, CORS, rate limits, body limits)

**Files:**
- Replace the stub in `src/middleware/security.ts`.
- Modify `src/server.ts`, `src/routes/file_routes.ts`; delete `src/config/cors.ts`.
- Test in `src/tests/security.http.test.ts`.

- [ ] **Step 1: Failing tests**

```ts
// src/tests/security.http.test.ts
import request from "supertest";
import mongoose from "mongoose";
import { Express } from "express";
import initApp from "../server";

let app: Express;
beforeAll(async () => { app = await initApp(); });
afterAll(async () => { await mongoose.connection.close(); });

describe("http hardening", () => {
  it("sets security headers and hides x-powered-by", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("allows configured origins only", async () => {
    const ok = await request(app).options("/items").set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "GET");
    expect(ok.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    const bad = await request(app).options("/items").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "GET");
    expect(bad.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rejects oversized JSON bodies", async () => {
    const res = await request(app).post("/auth/login").send({ email: "a@b.co", password: "x".repeat(200_000) });
    expect(res.status).toBe(413);
  });
});
```

- [ ] **Step 2:** Run it. Expected: FAIL (x-powered-by present, etc.).
- [ ] **Step 3: Implement**

```ts
// src/middleware/security.ts
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { config } from "../lib/config";

export const allowedOrigins = config.CLIENT_URLS;

export const corsMiddleware = cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
  exposedHeaders: ["X-Request-Id"],
  maxAge: 86400,
});

// images under /public are loaded cross-origin by the SPA
export const helmetMiddleware = helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } });

const limiter = (windowMs: number, limit: number) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => config.NODE_ENV === "test",
    message: { error: "RATE_LIMITED", message: "Too many requests, please try again later" },
  });

export const authLimiter = limiter(15 * 60 * 1000, 30);
export const uploadLimiter = limiter(60 * 60 * 1000, 40);
```

  - In `server.ts`:
    - Remove `dotenv`, `body-parser`, the manual `app.options` handler and `getAllowedOrigins`.
    - Set up in this order: `app.disable("x-powered-by")`, `httpLogger`, `helmetMiddleware`, `corsMiddleware`, `express.json({ limit: "100kb" })`, `express.urlencoded({ extended: true, limit: "100kb" })`, the routes, swagger, `notFoundHandler`, `errorHandler`.
    - Replace the `console.*` calls in `initApp` with `logger`.
    - Make `initApp` reject with an Error (it previously rejected with no value).
    - `mongoose.connect(config.DB_CONNECTION)`.
  - Socket CORS in `notification.socket.service.ts` uses `allowedOrigins`.
  - `file_routes.ts` (avatar upload before registration, so no auth):

```ts
router.post("/", uploadLimiter, imageUpload("users").single("file"), (req, res) => {
  if (!req.file) throw badRequest("Missing file");
  res.status(200).json({ url: `${config.DOMAIN_BASE}/public/users/${req.file.filename}` });
});
```

  - Delete `src/config/cors.ts`.
- [ ] **Step 4:** Run `npm test`. Expected: all PASS. Update `file.test.ts` if it uploaded a `.txt`; it should upload `test_image.png` instead.
- [ ] **Step 5:** Commit: `feat(security): helmet, strict CORS, rate limits and body size limits`.

### Task 10: Socket authentication

**Files:**
- Create `src/sockets/socket-auth.ts`.
- Modify `src/services/notification.socket.service.ts`, `src/services/chat.socket.service.ts`, `src/index.ts`, `frontend/src/services/notification.socket.service.ts` and `frontend/src/services/chat.socket.service.ts`.
- Test in `src/tests/socket.test.ts`.

Behaviour:
- Both the default namespace and `/chat` require `handshake.auth.token`, a valid access JWT. Otherwise `connect_error` with the message "unauthorized".
- The notification socket auto-joins room `userId` on connect. The legacy `authenticate` event becomes a no-op.
- Chat:
  - `register_user` and `get_user_chats` ignore their argument and use `socket.data.userId`.
  - `join_chat` requires the user to be a participant in the match; otherwise it emits `error`.
  - `send_message` uses `socket.data.userId` as the sender and derives the receiver from the match.
  - Content is a 1–2000 character trimmed string, and the sender must have joined that room.
  - `update_message_status` is accepted only from the message's receiver.

- [ ] **Step 1: Failing test**

```ts
// src/tests/socket.test.ts
import http from "http";
import { AddressInfo } from "net";
import mongoose from "mongoose";
import { io as ioc, Socket } from "socket.io-client";
import initApp from "../server";
import { initSocket } from "../services/notification.socket.service";
import { signAccessToken } from "../lib/tokens";
import matchModel from "../models/match_model";
import chatModel from "../models/chat_model";

let server: http.Server;
let url: string;
const A = new mongoose.Types.ObjectId().toString();
const B = new mongoose.Types.ObjectId().toString();
const C = new mongoose.Types.ObjectId().toString();
let matchId: string;
const sockets: Socket[] = [];

const connect = (ns: string, token?: string) =>
  new Promise<Socket>((resolve, reject) => {
    const s = ioc(`${url}${ns}`, { auth: token ? { token } : {}, transports: ["websocket"], forceNew: true });
    sockets.push(s);
    s.on("connect", () => resolve(s));
    s.on("connect_error", (e) => reject(e));
  });
const once = <T>(s: Socket, ev: string) => new Promise<T>((r) => s.once(ev, r));

beforeAll(async () => {
  const app = await initApp();
  server = http.createServer(app);
  initSocket(server);
  await new Promise<void>((r) => server.listen(0, r));
  url = `http://localhost:${(server.address() as AddressInfo).port}`;
  matchId = (await matchModel.create({ item1Id: "s1", userId1: A, item2Id: "s2", userId2: B, matchScore: 80 }))._id.toString();
});
afterAll(async () => {
  sockets.forEach((s) => s.close());
  await chatModel.deleteMany({ matchId });
  await matchModel.deleteMany({ _id: matchId });
  await new Promise((r) => server.close(r));
  await mongoose.connection.close();
});

describe("socket auth", () => {
  it("rejects connections without a valid token", async () => {
    await expect(connect("")).rejects.toThrow("unauthorized");
    await expect(connect("/chat", "garbage")).rejects.toThrow("unauthorized");
  });

  it("non-participants cannot join a chat", async () => {
    const s = await connect("/chat", signAccessToken(C));
    s.emit("join_chat", matchId);
    const err = await once<{ message: string }>(s, "error");
    expect(err.message).toMatch(/not part of this match/i);
  });

  it("messages are attributed to the authenticated sender", async () => {
    const sa = await connect("/chat", signAccessToken(A));
    const sb = await connect("/chat", signAccessToken(B));
    sa.emit("join_chat", matchId);
    sb.emit("join_chat", matchId);
    await Promise.all([once(sa, "chat_history"), once(sb, "chat_history")]);
    sa.emit("send_message", { matchId, senderId: C, receiverId: C, content: "  hi  " });
    const msg = await once<{ senderId: string; receiverId: string; content: string }>(sb, "new_message");
    expect(msg).toMatchObject({ senderId: A, receiverId: B, content: "hi" });
  });
});
```

- [ ] **Step 2:** Run it. Expected: FAIL (connections accepted without a token).
- [ ] **Step 3: Implement**

```ts
// src/sockets/socket-auth.ts
import { Socket } from "socket.io";
import { verifyToken } from "../lib/tokens";

export const socketAuth = (socket: Socket, next: (err?: Error) => void) => {
  const token = socket.handshake.auth?.token;
  if (typeof token !== "string") return next(new Error("unauthorized"));
  try {
    socket.data.userId = verifyToken(token, "access");
    next();
  } catch {
    next(new Error("unauthorized"));
  }
};
```

  - In `notification.socket.service.ts`:
    - Call `io.use(socketAuth)`.
    - On `connection`, run `socket.join(socket.data.userId)`.
    - Keep `socket.on("authenticate", () => {})` for older clients.
    - Use `logger.debug` instead of `console`.
    - Type `emitNotification(userId: string, notification: unknown)`, and drop the eslint-disable.
  - In `chat.socket.service.ts`:
    - Call `chatNamespace.use(socketAuth)`.
    - Register the user on connection, with no `register_user` needed. Keep the handler as a no-op that re-sends `online_users`.
    - Add this helper:

```ts
const participantMatch = async (matchId: unknown, userId: string) => {
  if (typeof matchId !== "string" || !mongoose.isValidObjectId(matchId)) return null;
  const match = await matchModel.findById(matchId).lean();
  return match && (match.userId1 === userId || match.userId2 === userId) ? match : null;
};
```

    - `join_chat`: `const match = await participantMatch(matchId, socket.data.userId); if (!match) return socket.emit("error", { message: "You are not part of this match" });`, then keep the existing history logic.
    - `send_message`:
      - Check `socket.rooms.has(data.matchId)` and that the match is the user's.
      - Trim `content` and require 1–2000 characters.
      - `senderId = socket.data.userId`, `receiverId = match.userId1 === senderId ? match.userId2 : match.userId1`.
    - `update_message_status`: run the update with the filter `{ _id: data.messageId, receiverId: socket.data.userId }` and status in `["delivered","read"]`.
    - `get_user_chats`: use `socket.data.userId`.
    - Replace every `console.*` with `logger`.
  - Frontend `notification.socket.service.ts` and `chat.socket.service.ts`: pass `auth: (cb) => cb({ token: localStorage.getItem("accessToken") })` in the `io(...)` options, so reconnects pick up refreshed tokens. Keep the existing emits; the server now ignores the ids they carry.
- [ ] **Step 4:** Run `npx jest socket.test.ts` (expected: PASS), then `npm test` (expected: all PASS).
- [ ] **Step 5:** Commit: `fix(security): authenticate sockets and enforce chat membership`.

### Task 11: Replace console.* with the logger, lint gate

**Files:** `src/services/gemini-service.ts`, `vision-service.ts`, `ai-matching-service.ts`, `matching-service.ts`, `src/index.ts`, `src/controllers/*`, `backend/eslint.config.mjs`.

- [ ] **Step 1:** Add `"no-console": "error"` to the backend ESLint rules.
- [ ] **Step 2:** Run `npx eslint .`. Expected: errors listing every remaining `console.*`.
- [ ] **Step 3:** Replace each one with `logger.info|warn|error|debug({ ...context }, "message")`:
  - Never log tokens, passwords or full request bodies.
  - In `gemini-service.ts`, log only the score and the item ids, not the prompt.
  - `index.ts`: use `config.PORT`, call `logger.info({ port }, "Server listening")`, and on `initApp` rejection call `logger.fatal({ err }, "Startup failed")` and then `process.exit(1)`.
- [ ] **Step 4:** Run `npx eslint . && npx tsc --noEmit && npm test`. Expected: all clean and green.
- [ ] **Step 5:** Commit: `refactor(backend): structured logging everywhere, ban console in lint`.

### Task 12: Frontend cleanup & error shape

**Files:** rename `frontend/src/components/RegristrationForm` → `RegistrationForm`; update the importers; `frontend/src/components/RegistrationForm/index.tsx`.

- [ ] **Step 1:** Run `git mv frontend/src/components/RegristrationForm frontend/src/components/RegistrationForm`, then update the imports: `grep -rln RegristrationForm frontend/src`.
- [ ] **Step 2:** The registration and login error display reads `error.response.data.message`, which already works with the new shape. The 409 for duplicates shows its message. Check that `Login/index.tsx` shows a message on 401: map `INVALID_CREDENTIALS` to "Email or password incorrect".
- [ ] **Step 3:** Run `cd frontend && npx eslint . && npm run build`. Expected: success.
- [ ] **Step 4:** Commit: `chore(frontend): fix component folder typo, authenticate sockets`.

### Task 13: CI + docs + PR

- [ ] **Step 1:** In `.github/workflows/ci.yml`, change the backend steps to `npm run lint`, `npm run typecheck` and `npm test`, and add `NODE_ENV: test` to the env.
- [ ] **Step 2:** `README.md`: add a short "Security" bullet list under Features: JWT-scoped access, ownership checks, socket auth, rate limits, helmet, Zod validation, structured logs.
- [ ] **Step 3:** Run the whole suite one last time, then push and open the PR:

```bash
cd backend && npm run lint && npm run typecheck && npm test
git push -u origin stage1-foundation
gh pr create -R nadavby/eureka --title "Foundation & security hardening" --body "<summary + test plan>"
```

- [ ] **Step 4:** Wait for CI to pass, then merge after review.
