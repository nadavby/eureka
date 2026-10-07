import mongoose from "mongoose";

/** One side of the demo starter match: fields copied into each visitor's sandbox. */
export interface DemoItemTemplate {
  imageUrl: string;
  category: string;
  description: string;
  colors: string[];
  brand?: string;
  date: Date;
  location: { lat: number; lng: number };
  placeName: string;
}

/** Written by `npm run seed:demo`; read by POST /auth/demo to build each visitor's scenario. */
export interface IDemoTemplate {
  botId: string;
  score: number;
  reasons: string[];
  conflicts: string[];
  /** The bot's opening chat message, and its single reply to the visitor's first message. */
  firstMessage: string;
  botReply: string;
  lost: DemoItemTemplate;
  found: DemoItemTemplate;
}

const side = {
  imageUrl: { type: String, required: true },
  category: { type: String, required: true },
  description: String,
  colors: [String],
  brand: String,
  date: { type: Date, required: true },
  location: { type: mongoose.Schema.Types.Mixed, required: true },
  placeName: String,
};

const schema = new mongoose.Schema<IDemoTemplate>(
  {
    botId: { type: String, required: true },
    score: { type: Number, required: true },
    reasons: [String],
    conflicts: [String],
    firstMessage: { type: String, required: true },
    botReply: { type: String, required: true },
    lost: side,
    found: side,
  },
  { timestamps: true }
);

const demoTemplateModel = mongoose.model<IDemoTemplate>("demo_templates", schema);
export default demoTemplateModel;
