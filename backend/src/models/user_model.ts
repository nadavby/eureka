import mongoose from "mongoose";

export interface iUser {
  email: string;
  password: string;
  _id?: string;
  refreshToken?: string[];
  imgURL?: string;
  userName: string;
  phoneNumber: string;
  /** Demo accounts: "seed" bots own the public demo items, "visitor" accounts are created by Try the demo. */
  demoRole?: "seed" | "visitor";
  createdAt?: Date;
}

const userSchema = new mongoose.Schema<iUser>({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: [String],
    default: [],
  },
  imgURL: {
    type: String,
  },
  userName: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  demoRole: { type: String, enum: ["seed", "visitor"], index: true },
}, { timestamps: true });

// Never serialize credentials, whatever route returns a user document.
userSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.password;
    delete ret.refreshToken;
    delete ret.__v;
    return ret;
  },
});

const userModel = mongoose.model<iUser>("users", userSchema);

export default userModel;
