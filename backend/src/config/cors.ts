// Origins allowed to call the API and open sockets. CLIENT_URL may hold a
// comma-separated list (e.g. the deployed frontend URL).
export const getAllowedOrigins = (): string[] =>
  [
    "http://localhost:3002",
    "http://localhost:5173",
    process.env.DOMAIN_BASE,
    ...(process.env.CLIENT_URL || "").split(","),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => !!origin);
