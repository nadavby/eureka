import { GoogleGenAI, Part } from "@google/genai";
import { ZodType } from "zod";
import { config } from "../lib/config";
import { logger } from "../lib/logger";
import { AiDisabledError, AiQuotaError, AiResponseError } from "./errors";
import { RateLimiter } from "./rate-limiter";
import { FakeAiClient } from "./fake-ai";

export { AiDisabledError, AiQuotaError, AiResponseError };
export type { Part };

/** The slice of the @google/genai SDK we use; tests pass a fake with the same shape. */
export type GenAiSdk = Pick<GoogleGenAI, "models">;

export interface GenerateJsonRequest<T> {
  model: string;
  parts: Part[];
  /** JSON Schema sent to Gemini so it constrains its output. */
  jsonSchema: Record<string, unknown>;
  /** Zod schema the reply is validated against (the model is not trusted blindly). */
  schema: ZodType<T>;
  temperature?: number;
}

export interface AiClient {
  generateJson<T>(req: GenerateJsonRequest<T>): Promise<T>;
  embed(req: { model: string; parts: Part[] }): Promise<number[]>;
}

const isQuotaError = (err: unknown) => {
  const status = (err as { status?: number; code?: number })?.status ?? (err as { code?: number })?.code;
  return status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(String((err as Error)?.message));
};

export class GeminiAiClient implements AiClient {
  constructor(
    private readonly sdk: GenAiSdk | null,
    private readonly limiter: RateLimiter,
    private readonly opts: { embedDimensions: number }
  ) {}

  private async call<T>(fn: (sdk: GenAiSdk) => Promise<T>): Promise<T> {
    if (!this.sdk) throw new AiDisabledError();
    this.limiter.take();
    try {
      return await fn(this.sdk);
    } catch (err) {
      if (isQuotaError(err)) throw new AiQuotaError();
      throw err;
    }
  }

  async generateJson<T>(req: GenerateJsonRequest<T>): Promise<T> {
    let lastError: unknown;
    // One retry: structured output is reliable, but an occasional malformed reply happens.
    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await this.call((sdk) =>
        sdk.models.generateContent({
          model: req.model,
          contents: [{ role: "user", parts: req.parts }],
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: req.jsonSchema,
            temperature: req.temperature ?? 0.2,
          },
        })
      );
      try {
        return req.schema.parse(JSON.parse(response.text ?? ""));
      } catch (err) {
        lastError = err;
        logger.warn({ model: req.model, attempt }, "Gemini returned an invalid structured response");
      }
    }
    throw new AiResponseError(`Invalid structured response: ${(lastError as Error)?.message}`);
  }

  async embed(req: { model: string; parts: Part[] }): Promise<number[]> {
    const response = await this.call((sdk) =>
      sdk.models.embedContent({
        model: req.model,
        // A single content with several parts yields ONE embedding of the image and text together.
        contents: [{ parts: req.parts }],
        config: { outputDimensionality: this.opts.embedDimensions },
      })
    );
    const values = response.embeddings?.[0]?.values;
    if (!values || values.length !== this.opts.embedDimensions) {
      throw new AiResponseError(`Expected a ${this.opts.embedDimensions}-dimension embedding`);
    }
    return values;
  }
}

export const createAiClient = (): AiClient =>
  config.AI_FAKE
    ? new FakeAiClient(config.EMBEDDING_DIMENSIONS)
    : new GeminiAiClient(
    config.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: config.GEMINI_API_KEY }) : null,
    new RateLimiter(config.AI_REQUESTS_PER_MINUTE, 60_000),
    { embedDimensions: config.EMBEDDING_DIMENSIONS }
  );
