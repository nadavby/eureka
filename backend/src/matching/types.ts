import { z } from "zod";

/** Structured description of an item, extracted by Gemini from the photo and the user's fields. */
export const itemAttributesSchema = z.object({
  category: z.string(),
  subcategory: z.string(),
  brand: z.string(),
  model: z.string(),
  colors: z.array(z.string()).max(6),
  material: z.string(),
  distinctiveFeatures: z.array(z.string()).max(8),
  visibleText: z.array(z.string()).max(8),
  description: z.string(),
});
export type ItemAttributes = z.infer<typeof itemAttributesSchema>;

/** Gemini's judgement of whether a lost item and a found item are the same physical object. */
export const pairVerdictSchema = z.object({
  score: z.number(),
  verdict: z.enum(["match", "possible", "no_match"]),
  reasons: z.array(z.string()).max(6),
  conflicts: z.array(z.string()).max(6),
});
export type PairVerdict = z.infer<typeof pairVerdictSchema>;

export type ItemType = "lost" | "found";
export type LatLng = { lat: number; lng: number };

/** The subset of an item the matching logic needs. */
export interface MatchableItem {
  _id: string;
  itemType: ItemType;
  category?: string;
  date?: Date;
  location?: LatLng | string;
  isResolved?: boolean;
}

export const MATCHING_STATUSES = ["analyzing", "searching", "done", "failed"] as const;
export type MatchingStatus = (typeof MATCHING_STATUSES)[number];
