// Defaults for variables the config schema requires, so tests run without a .env file.
process.env.NODE_ENV = "test";
process.env.TOKEN_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.TOKEN_EXPIRATION ??= "15m";
process.env.REFRESH_TOKEN_EXPIRATION ??= "7d";
process.env.DOMAIN_BASE ??= "http://localhost:3000";
// Dummy keys: tests mock the Google AI services
process.env.GEMINI_API_KEY ??= "test-dummy";
process.env.GOOGLE_CLOUD_VISION_API_KEY ??= "test-dummy";
