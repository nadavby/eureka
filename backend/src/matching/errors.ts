/** No GEMINI_API_KEY configured: matching cannot run at all. */
export class AiDisabledError extends Error {
  constructor() {
    super("AI matching is disabled");
  }
}

/** Over the local rate limit or the provider's quota; the work should be retried later. */
export class AiQuotaError extends Error {
  constructor(public readonly retryAfterMs = 60_000) {
    super("AI quota exhausted");
  }
}

/** The model answered, but not with something we can use. */
export class AiResponseError extends Error {}
