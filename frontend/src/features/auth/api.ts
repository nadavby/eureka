import { api } from "@/lib/api";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const login = async (email: string, password: string) =>
  (await api.post<TokenPair & { _id: string }>("/auth/login", { email, password })).data;

export const googleSignIn = async (credential: string) =>
  (await api.post<TokenPair & { _id: string }>("/auth/google", { credential })).data;

export interface RegisterInput {
  email: string;
  password: string;
  userName: string;
  phoneNumber: string;
  imgURL?: string | null;
}

export const register = async (input: RegisterInput) => (await api.post("/auth/register", input)).data;

/** Uploads a profile picture before the account exists; returns its URL. */
export const uploadAvatar = async (file: Blob) => {
  const form = new FormData();
  form.append("file", file, "avatar.jpg");
  return (await api.post<{ url: string }>("/file", form)).data.url;
};
