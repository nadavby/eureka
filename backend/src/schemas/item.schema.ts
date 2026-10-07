import { z } from "zod";
import { objectId } from "./common";

const json = (v: unknown) => {
  if (typeof v !== "string") return v;
  try {
    return JSON.parse(v);
  } catch {
    return v;
  }
};

// multipart fields arrive as strings; location arrives as a JSON string
const location = z.preprocess(
  json,
  z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
);
const colors = z.preprocess(
  (v) => {
    const parsed = json(v);
    return typeof parsed === "string" ? parsed.split(",").map((s) => s.trim()).filter(Boolean) : parsed;
  },
  z.array(z.string().max(30)).max(10)
);

// Not strict: legacy clients send extra keys (userId, name, kind). Unknown keys are
// stripped, which is exactly how a client-supplied userId gets discarded.
export const createItemBody = z.object({
  itemType: z.string().toLowerCase().pipe(z.enum(["lost", "found"])),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(1).max(60),
  date: z.coerce.date(),
  location,
  placeName: z.string().trim().max(120).optional(),
  colors: colors.optional(),
  brand: z.string().trim().max(60).optional(),
  condition: z.enum(["new", "worn", "damaged", "other"]).optional(),
  flaws: z.string().trim().max(500).optional(),
  material: z.string().trim().max(60).optional(),
});

export const listItemsQuery = z.object({
  itemType: z.enum(["lost", "found"]).optional(),
  userId: objectId.optional(),
  /** "true": only items that are not resolved yet */
  open: z.enum(["true", "false"]).optional(),
});
