/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose from "mongoose";

export interface IItem {
  _id?: string;
  userId: string;
  imageUrl: string;
  itemType: 'lost' | 'found';
  description?: string;
  location?: {
    lat: number;
    lng: number;
  } | string;
  date?: Date;
  category?: string;
  colors?: string[];
  brand?: string;
  condition?: 'new' | 'worn' | 'damaged' | 'other';
  flaws?: string;
  material?: string;
  ownerName?: string;
  ownerEmail?: string;
  visionApiData?: {
    labels?: string[];
    objects?: Array<{
      name: string;
      score: number;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    }>;
    texts?: Array<{
      text: string;
      confidence?: number;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    }>;
    logos?: Array<{
      description: string;
      score: number;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    }>;
  };
  matchedItemId?: string;
  isResolved?: boolean;
}

const itemSchema = new mongoose.Schema<IItem>(
  {
    userId: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    itemType: {
      type: String,
      enum: ['lost', 'found'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    colors: {
      type: [String],
      required: true,
    },
    brand: {
      type: String,
    },
    condition: {
      type: String,
      required: true,
    },
    flaws: {
      type: String,
    },
    material: {
      type: String,
      required: true,
    },
    visionApiData: {
      labels: [String],
      objects: [{
        name: String,
        score: Number,
        boundingBox: {
          x: Number,
          y: Number,
          width: Number,
          height: Number,
        }
      }],
      texts: [{
        text: String,
        confidence: Number,
        boundingBox: {
          x: Number,
          y: Number,    
          width: Number,
          height: Number,
        }
      }],
      logos: [{
        description: String,    
        score: Number,
        boundingBox: {
          x: Number,
          y: Number,
          width: Number,
          height: Number,
        }
      }]
    },
    matchedItemId: {
      type: String,
    },
    isResolved: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const itemModel = mongoose.model<IItem>("items", itemSchema);

export default itemModel; 