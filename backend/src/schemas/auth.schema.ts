import { z } from "zod";

const password = z.string().min(8, "Password must be at least 8 characters").max(128);
const userName = z.string().trim().min(2).max(40);
const phoneNumber = z.string().trim().max(20);

export const registerBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password,
  userName,
  phoneNumber,
  imgURL: z.string().url().nullish(),
});

export const loginBody = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
export const refreshBody = z.object({ refreshToken: z.string().min(1) });
export const googleBody = z.object({ credential: z.string().min(1) });

export const updateUserBody = z
  .object({ userName, phoneNumber, imgURL: z.string().url().nullable(), password })
  .partial()
  .strict();
