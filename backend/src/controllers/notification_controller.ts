import { Request, Response } from "express";
import notificationModel from "../models/notification_model";
import { notFound } from "../lib/errors";

// Every query is scoped to the authenticated user. Someone else's notification is
// reported as "not found" so its existence isn't revealed.

const getAllByUserId = async (req: Request, res: Response) => {
  const notifications = await notificationModel.find({ userId: req.user!.id }).sort({ createdAt: -1 });
  res.json({ data: notifications });
};

const getById = async (req: Request, res: Response) => {
  const notification = await notificationModel.findOne({ _id: req.params.id, userId: req.user!.id });
  if (!notification) throw notFound("Notification not found");
  res.json({ data: notification });
};

const deleteById = async (req: Request, res: Response) => {
  const notification = await notificationModel.findOneAndDelete({ _id: req.params.id, userId: req.user!.id });
  if (!notification) throw notFound("Notification not found");
  res.json({ message: "Notification deleted successfully" });
};

const markAsRead = async (req: Request, res: Response) => {
  const notification = await notificationModel.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!.id },
    { isRead: true },
    { new: true }
  );
  if (!notification) throw notFound("Notification not found");
  res.json({ data: notification });
};

const markAllAsRead = async (req: Request, res: Response) => {
  const result = await notificationModel.updateMany({ userId: req.user!.id, isRead: false }, { isRead: true });
  res.json({ message: "All notifications marked as read", modifiedCount: result.modifiedCount });
};

export default { getAllByUserId, getById, deleteById, markAsRead, markAllAsRead };
