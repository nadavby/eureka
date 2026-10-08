import { z } from "zod";
import { AiDisabledError, AiQuotaError, AiResponseError, GeminiAiClient, GenAiSdk } from "../../matching/ai-client";
import { RateLimiter } from "../../matching/rate-limiter";

const schema = z.object({ answer: z.string() });
const jsonSchema = { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] };

const fakeSdk = () => ({
  models: {
    generateContent: jest.fn(),
    embedContent: jest.fn(),
  },
});

const client = (sdk: ReturnType<typeof fakeSdk> | null, limiter = new RateLimiter(100, 60_000)) =>
  new GeminiAiClient(sdk as unknown as GenAiSdk | null, limiter, { embedDimensions: 4 });

describe("RateLimiter", () => {
  afterEach(() => jest.useRealTimers());

  it("allows N requests per window and then reports when to retry", () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new RateLimiter(2, 60_000);
    limiter.take();
    limiter.take();
    try {
      limiter.take();
      throw new Error("expected AiQuotaError");
    } catch (err) {
      expect(err).toBeInstanceOf(AiQuotaError);
      expect((err as AiQuotaError).retryAfterMs).toBeGreaterThan(0);
      expect((err as AiQuotaError).retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it("refills after the window", () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new RateLimiter(1, 60_000);
    limiter.take();
    jest.setSystemTime(60_001);
    expect(() => limiter.take()).not.toThrow();
  });
});

describe("GeminiAiClient.generateJson", () => {
  it("requests JSON with the schema and validates the reply", async () => {
    const sdk = fakeSdk();
    sdk.models.generateContent.mockResolvedValue({ text: '{"answer":"42"}' });
    const result = await client(sdk).generateJson({ model: "m", parts: [{ text: "q" }], jsonSchema, schema });
    expect(result).toEqual({ answer: "42" });
    const call = sdk.models.generateContent.mock.calls[0][0];
    expect(call.model).toBe("m");
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.config.responseJsonSchema).toEqual(jsonSchema);
  });

  it("retries once on an invalid reply, then fails with AiResponseError", async () => {
    const sdk = fakeSdk();
    sdk.models.generateContent
      .mockResolvedValueOnce({ text: "not json" })
      .mockResolvedValueOnce({ text: '{"answer":"ok"}' });
    expect(await client(sdk).generateJson({ model: "m", parts: [], jsonSchema, schema })).toEqual({ answer: "ok" });

    sdk.models.generateContent.mockReset().mockResolvedValue({ text: '{"wrong":1}' });
    await expect(client(sdk).generateJson({ model: "m", parts: [], jsonSchema, schema })).rejects.toBeInstanceOf(
      AiResponseError
    );
    expect(sdk.models.generateContent).toHaveBeenCalledTimes(2);
  });

  it("maps a 429 from the API to AiQuotaError", async () => {
    const sdk = fakeSdk();
    sdk.models.generateContent.mockRejectedValue(Object.assign(new Error("quota"), { status: 429 }));
    await expect(client(sdk).generateJson({ model: "m", parts: [], jsonSchema, schema })).rejects.toBeInstanceOf(
      AiQuotaError
    );
  });

  it("refuses to run without an API key", async () => {
    await expect(client(null).generateJson({ model: "m", parts: [], jsonSchema, schema })).rejects.toBeInstanceOf(
      AiDisabledError
    );
  });

  it("does not call the API when the local rate limit is exhausted", async () => {
    const sdk = fakeSdk();
    sdk.models.generateContent.mockResolvedValue({ text: '{"answer":"x"}' });
    const c = client(sdk, new RateLimiter(1, 60_000));
    await c.generateJson({ model: "m", parts: [], jsonSchema, schema });
    await expect(c.generateJson({ model: "m", parts: [], jsonSchema, schema })).rejects.toBeInstanceOf(AiQuotaError);
    expect(sdk.models.generateContent).toHaveBeenCalledTimes(1);
  });
});

describe("GeminiAiClient.embed", () => {
  it("returns one vector of the configured size for image + text", async () => {
    const sdk = fakeSdk();
    sdk.models.embedContent.mockResolvedValue({ embeddings: [{ values: [0.1, 0.2, 0.3, 0.4] }] });
    const vector = await client(sdk).embed({
      model: "e",
      parts: [{ inlineData: { mimeType: "image/png", data: "AAAA" } }, { text: "category: wallet" }],
    });
    expect(vector).toEqual([0.1, 0.2, 0.3, 0.4]);
    const call = sdk.models.embedContent.mock.calls[0][0];
    expect(call.config.outputDimensionality).toBe(4);
    // image and text form ONE content, so they produce one combined embedding
    expect(call.contents).toHaveLength(1);
    expect(call.contents[0].parts).toHaveLength(2);
  });

  it("rejects a vector of the wrong size", async () => {
    const sdk = fakeSdk();
    sdk.models.embedContent.mockResolvedValue({ embeddings: [{ values: [1, 2] }] });
    await expect(client(sdk).embed({ model: "e", parts: [{ text: "x" }] })).rejects.toBeInstanceOf(AiResponseError);
  });
});
