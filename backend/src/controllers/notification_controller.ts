/** @format */

import { Request, Response } from "express";
import notificationModel from "../models/notification_model";
import mongoose from "mongoose";

const getAllByUserId = async (req: Request, res: Response) => {
  const userId = req.query.userId;
  if (!userId) {
    res.status(400).send({ error: "User ID is required" });
    return;
  }
  try {
    const notifications = await notificationModel.find({ userId: userId });
    res.status(200).send({ data: notifications || [] });
    return;
  } catch (error) {
    console.error("Error getting notifications by user ID:", error);
    res.status(500).send({ error: "Internal server error" });
    return;
  }
};

const getById = async (req: Request, res: Response) => {
  const notificationId = req.params.id;
  
  if (!notificationId) {
    res.status(400).send({ error: "Notification ID is required" });
    return;
  }

  try {
    const notification = await notificationModel.findById(notificationId);
    if (!notification) {
      res.status(404).send({ error: "Notification not found" });
      return;
    }
    res.status(200).send({ data: notification });
    return;
  } catch (error) {
    console.error("Error getting notification by ID:", error);
    res.status(500).send({ error: "Internal server error" });
    return;
  }
};

const deleteById = async (req: Request, res: Response) => {
  const notificationId = req.params.id;
  
  if (!notificationId) {
    res.status(400).send({ error: "Notification ID is required" });
    return;
  }

  try {
    const notification = await notificationModel.findByIdAndDelete(notificationId);
    if (!notification) {
      res.status(404).send({ error: "Notification not found" });
      return;
    }
    res.status(200).send({ message: "Notification deleted successfully" });
    return;
  } catch (error) {
    console.error("Error deleting notification by ID:", error);
    res.status(500).send({ error: "Internal server error" });
    return;
  }
};

const markAsRead = async (req: Request, res: Response) => {
  const notificationId = req.params.id;
  
  if (!notificationId) {
    res.status(400).send({ error: "Notification ID is required" });
    return;
  }

  try {
    const notification = await notificationModel.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true }
    );
    if (!notification) {
      res.status(404).send({ error: "Notification not found" });
      return;
    }

    res.status(200).send({ data: notification });
    return;
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).send({ error: "Internal server error" });
    return;
  }
};

const markAllAsRead = async (req: Request, res: Response) => {
  const userId = req.body.userId;
  
  if (!userId) {
    res.status(400).send({ error: "User ID is required" });
    return;
  }

  try {
    const result = await notificationModel.updateMany(
      { userId: userId, isRead: false },
      { isRead: true }
    );

    res.status(200).send({ 
      message: "All notifications marked as read",
      modifiedCount: result.modifiedCount 
    });
    return;
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).send({ error: "Internal server error" });
    return;
  }
};

const DeleteAllByUserId = async (req: Request, res: Response) => {
  const userId = req.body.userId;
  if (!userId) {
    res.status(400).send({ error: "User ID is required" });
    return;
  }
  try {
    const result = await notificationModel.deleteMany({ userId: userId });
    res.status(200).send({ message: "All notifications deleted successfully" });
    return;
  } catch (error) {
    res.status(500).send({ error: "Internal server error" });
    return;
  }
};

export default {
  getAllByUserId,
  getById,
  deleteById,
  markAsRead,
  markAllAsRead,
  DeleteAllByUserId,
};
