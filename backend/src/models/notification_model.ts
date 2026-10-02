import mongoose from 'mongoose';

export interface INotification {
    _id?: string;
    userId: string;
    matchId: string;
    type:string;
    title: string;
    message: string;
    isRead: boolean;
}

const notificationSchema = new mongoose.Schema<INotification>(
    {
        userId: {
            type: String,
            required: true,
        },
        matchId: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        }
        
    },
    { timestamps: true }
);

const notificationModel = mongoose.model<INotification>('notification', notificationSchema);

export default notificationModel;
