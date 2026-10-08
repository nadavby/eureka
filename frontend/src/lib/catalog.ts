/**
 * Stable category and color values. The value is what is stored and what matching compares
 * (vector search pre-filters on the exact category), so values must never be renamed.
 * Labels live in the locale files under categories.* and colors.*.
 */
export const CATEGORIES = [
  "wallet",
  "keys",
  "phone",
  "bag",
  "id_card",
  "glasses",
  "watch",
  "jewelry",
  "headphones",
  "laptop",
  "tablet",
  "camera",
  "umbrella",
  "clothing",
  "toy",
  "bicycle",
  "pet",
  "documents",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const COLORS = [
  { value: "black", hex: "#1f2328" },
  { value: "white", hex: "#f7f7f5" },
  { value: "gray", hex: "#8b919a" },
  { value: "silver", hex: "#c4c9cf" },
  { value: "gold", hex: "#d4af37" },
  { value: "brown", hex: "#7b4a2c" },
  { value: "beige", hex: "#e3d3b5" },
  { value: "red", hex: "#d03b2f" },
  { value: "orange", hex: "#ec7a23" },
  { value: "yellow", hex: "#f2c94c" },
  { value: "green", hex: "#2f9e5a" },
  { value: "blue", hex: "#2f6fdb" },
  { value: "navy", hex: "#1d2b53" },
  { value: "purple", hex: "#7d4cc9" },
  { value: "pink", hex: "#ee8fb4" },
  { value: "multicolored", hex: "conic-gradient(#d03b2f, #f2c94c, #2f9e5a, #2f6fdb, #d03b2f)" },
] as const;
export type Color = (typeof COLORS)[number]["value"];

export const isKnownCategory = (value: string): value is Category => (CATEGORIES as readonly string[]).includes(value);
