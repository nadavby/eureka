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
