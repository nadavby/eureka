/** @format */

import { createContext, useContext } from "react";
import { INotification } from "../services/notification-service";

export interface NotificationsContextType {
  notifications: INotification[];
  error: string | null;
  isLoading: boolean;
  addNotification: (notification: INotification) => void;
  removeNotification: (notificationId: string) => Promise<void>;
  clearNotifications: () => void;
  fetchNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  unreadCount: number;
}

export const NotificationsContext =
  createContext<NotificationsContextType | null>(null);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider"
    );
  }
  return context;
};
