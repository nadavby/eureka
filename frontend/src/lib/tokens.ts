const ACCESS = "accessToken";
const REFRESH = "refreshToken";

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Reads the user id from an access token without verifying it (the server verifies). */
const userIdFrom = (token: string | null): string | null => {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload._id === "string" ? payload._id : null;
  } catch {
    return null;
  }
};

export const tokens = {
  access: () => read(ACCESS),
  refresh: () => read(REFRESH),
  userId: () => userIdFrom(read(ACCESS)),
  set(access: string, refresh: string) {
    localStorage.setItem(ACCESS, access);
    localStorage.setItem(REFRESH, refresh);
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
  },
};
