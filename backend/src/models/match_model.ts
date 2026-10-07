import mongoose from "mongoose";

export interface IMatch {
  _id?: string;
  /** The item that was already in the system when the match was found. */
  item1Id: string;
  userId1: string;
  /** The item whose upload triggered the match. */
  item2Id: string;
  userId2: string;
  matchScore: number;
  user1Confirmed: boolean;
  user2Confirmed: boolean;
  /** Order-independent pair id; a unique index makes match creation idempotent. */
  pairKey?: string;
  verdict?: "match" | "possible" | "no_match";
  reasons?: string[];
  conflicts?: string[];
}

export const pairKeyOf = (a: string, b: string) => [a, b].sort().join(":");

const matchSchema = new mongoose.Schema<IMatch>(
  {
    item1Id: { type: String, required: true, index: true },
    userId1: { type: String, required: true, index: true },
    item2Id: { type: String, required: true, index: true },
    userId2: { type: String, required: true, index: true },
    matchScore: { type: Number, required: true },
    user1Confirmed: { type: Boolean, default: false },
    user2Confirmed: { type: Boolean, default: false },
    pairKey: { type: String, unique: true, sparse: true },
    verdict: { type: String, enum: ["match", "possible", "no_match"] },
    reasons: { type: [String], default: [] },
    conflicts: { type: [String], default: [] },
  },
  { timestamps: true }
);

matchSchema.pre("validate", function () {
  if (!this.pairKey && this.item1Id && this.item2Id) this.pairKey = pairKeyOf(this.item1Id, this.item2Id);
});

const matchModel = mongoose.model<IMatch>("matches", matchSchema);
export default matchModel;
