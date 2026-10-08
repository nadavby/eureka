import axios, { AxiosError, AxiosRequestConfig } from "axios";
import { env } from "./env";
import { tokens } from "./tokens";

export const api = axios.create({ baseURL: env.apiUrl });

api.interceptors.request.use((config) => {
  const access = tokens.access();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  return config;
});

// Credential endpoints answer 401 for bad credentials; refreshing would not help.
const CREDENTIAL_ENDPOINTS = /^\/auth\/(login|register|google|refresh|logout)$/;

let refreshing: Promise<string | null> | null = null;

/** One refresh at a time: concurrent 401s wait for the same request instead of racing (and revoking each other). */
export const refreshAccessToken = (): Promise<string | null> => {
  refreshing ??= (async () => {
    const refreshToken = tokens.refresh();
    if (!refreshToken) return null;
    try {
      const { data } = await axios.post(`${env.apiUrl}/auth/refresh`, { refreshToken });
      tokens.set(data.accessToken, data.refreshToken);
      return data.accessToken as string;
    } catch {
      tokens.clear();
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
};

api.interceptors.response.use(undefined, async (error: AxiosError) => {
  const original = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
  if (error.response?.status !== 401 || !original || original._retried || CREDENTIAL_ENDPOINTS.test(original.url ?? "")) {
    throw error;
  }
  original._retried = true;
  const access = await refreshAccessToken();
  if (!access) {
    window.dispatchEvent(new Event("eureka:signed-out"));
    throw error;
  }
  original.headers = { ...original.headers, Authorization: `Bearer ${access}` };
  return api(original);
});

/** The API's error message, for showing to the user. */
export const errorMessage = (err: unknown, fallback: string): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (!err.response) return fallback;
  }
  return fallback;
};

export const errorCode = (err: unknown): string | undefined =>
  axios.isAxiosError(err) ? (err.response?.data as { error?: string } | undefined)?.error : undefined;
