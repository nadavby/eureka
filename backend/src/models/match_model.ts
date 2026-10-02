import mongoose from 'mongoose';

export interface IMatch {
    _id?: string;
    item1Id: string;
    userId1: string;
    item2Id: string;
    userId2: string;
    matchScore: number;
    user1Confirmed: boolean;
    user2Confirmed: boolean;
}

const matchSchema = new mongoose.Schema<IMatch>(
    {
        item1Id: {
            type: String,
            required: true,
        },
        userId1: {
            type: String,
            required: true,
        },
        item2Id: {
            type: String,
            required: true,
        },
        userId2: {
            type: String,
            required: true,
        },
        matchScore: {
            type: Number,
            required: true,
        },
        user1Confirmed: {
            type: Boolean,
            default: false,
        },
        user2Confirmed: {
            type: Boolean,
            default: false,
        }
    },
    { timestamps: true }
);

const matchModel = mongoose.model<IMatch>('matches', matchSchema);

export default matchModel;
