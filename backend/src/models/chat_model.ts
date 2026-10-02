import mongoose, { Schema, Document } from 'mongoose';

export interface IChatMessage extends Document {
  matchId: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'read';
}

const chatMessageSchema = new Schema<IChatMessage>({
  matchId: {
    type: String,
    required: true,
    index: true
  },
  senderId: {
    type: String,
    required: true,
    index: true
  },
  receiverId: {
    type: String,
    required: true,
    index: true
  },
  content: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  }
});

// Create compound indexes for common queries
chatMessageSchema.index({ matchId: 1, timestamp: -1 });
chatMessageSchema.index({ senderId: 1, receiverId: 1, timestamp: -1 });

const chatModel = mongoose.model<IChatMessage>('ChatMessage', chatMessageSchema);
export default chatModel; 