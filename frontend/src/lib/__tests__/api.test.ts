import axios from "axios";
import { api, refreshAccessToken } from "@/lib/api";
import { tokens } from "@/lib/tokens";

describe("refreshAccessToken", () => {
  beforeEach(() => {
    tokens.set("old-access", "refresh-1");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    tokens.clear();
  });

  it("sends a single refresh request for concurrent callers", async () => {
    const post = vi.spyOn(axios, "post").mockResolvedValue({ data: { accessToken: "new-access", refreshToken: "refresh-2" } });
    const results = await Promise.all([refreshAccessToken(), refreshAccessToken(), refreshAccessToken()]);
    expect(results).toEqual(["new-access", "new-access", "new-access"]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(tokens.refresh()).toBe("refresh-2");
  });

  it("clears the session when the refresh token is rejected", async () => {
    vi.spyOn(axios, "post").mockRejectedValue(new Error("401"));
    expect(await refreshAccessToken()).toBeNull();
    expect(tokens.access()).toBeNull();
  });
});

describe("api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    tokens.clear();
  });

  it("retries a request once with a fresh token after a 401", async () => {
    tokens.set("expired", "refresh-1");
    vi.spyOn(axios, "post").mockResolvedValue({ data: { accessToken: "fresh", refreshToken: "refresh-2" } });
    const seen: string[] = [];
    api.defaults.adapter = async (config) => {
      const auth = String(config.headers.Authorization);
      seen.push(auth);
      if (auth === "Bearer expired") {
        throw new axios.AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
          status: 401, statusText: "Unauthorized", headers: {}, config, data: { error: "TOKEN_EXPIRED" },
        });
      }
      return { data: { ok: true }, status: 200, statusText: "OK", headers: {}, config };
    };
    const res = await api.get("/notification");
    expect(res.data).toEqual({ ok: true });
    expect(seen).toEqual(["Bearer expired", "Bearer fresh"]);
  });

  it("does not try to refresh when a login is rejected", async () => {
    const post = vi.spyOn(axios, "post");
    api.defaults.adapter = async (config) => {
      throw new axios.AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, null, {
        status: 401, statusText: "Unauthorized", headers: {}, config, data: { error: "INVALID_CREDENTIALS" },
      });
    };
    await expect(api.post("/auth/login", {})).rejects.toBeInstanceOf(axios.AxiosError);
    expect(post).not.toHaveBeenCalled();
  });
});
