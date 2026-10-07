import mongoose from "mongoose";
import { ItemAttributes, MATCHING_STATUSES, MatchingStatus } from "../matching/types";

export interface IItem {
  _id?: string;
  userId: string;
  imageUrl: string;
  /** Storage handle of the image, used to delete it with the item. */
  imagePublicId?: string;
  itemType: "lost" | "found";
  description?: string;
  location?: { lat: number; lng: number } | string;
  /** Human-readable place, e.g. "Tel Aviv, Habima Square" (from the map or typed). */
  placeName?: string;
  date?: Date;
  category?: string;
  colors?: string[];
  brand?: string;
  condition?: "new" | "worn" | "damaged" | "other";
  flaws?: string;
  material?: string;
  /** Extracted by Gemini from the photo and the user's fields. */
  attributes?: ItemAttributes;
  /** Multimodal embedding (photo + canonical text). Large, so never selected by default. */
  embedding?: number[];
  matchingStatus?: MatchingStatus;
  matchingError?: string;
  matchCount?: number;
  isResolved?: boolean;
  createdAt?: Date;
}

const attributesSchema = new mongoose.Schema<ItemAttributes>(
  {
    category: String,
    subcategory: String,
    brand: String,
    model: String,
    colors: [String],
    material: String,
    distinctiveFeatures: [String],
    visibleText: [String],
    description: String,
  },
  { _id: false }
);

const itemSchema = new mongoose.Schema<IItem>(
  {
    userId: { type: String, required: true, index: true },
    imageUrl: { type: String, required: true },
    imagePublicId: String,
    itemType: { type: String, enum: ["lost", "found"], required: true },
    description: String,
    date: { type: Date, required: true },
    location: { type: mongoose.Schema.Types.Mixed, required: true },
    placeName: String,
    category: { type: String, required: true },
    colors: { type: [String], default: [] },
    brand: String,
    condition: { type: String, enum: ["new", "worn", "damaged", "other"] },
    flaws: String,
    material: String,
    attributes: attributesSchema,
    embedding: { type: [Number], select: false },
    matchingStatus: { type: String, enum: MATCHING_STATUSES, default: "analyzing" },
    matchingError: String,
    matchCount: { type: Number, default: 0 },
    isResolved: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Candidate lookups: opposite type, same category, still open.
itemSchema.index({ itemType: 1, category: 1, isResolved: 1 });

itemSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.__v;
    delete ret.embedding;
    delete ret.imagePublicId;
    return ret;
  },
});

const itemModel = mongoose.model<IItem>("items", itemSchema);

export default itemModel;
