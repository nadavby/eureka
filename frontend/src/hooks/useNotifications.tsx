/** @format */

import {
  useCallback,
  useState,
  useEffect,
  createContext,
  useContext,
  ReactNode,
} from "react";
import socketService from "../services/notification.socket.service";
import notificationService, {
  INotification,
  CanceledError,
} from "../services/notification-service";
import { useAuth } from "./useAuth";

interface NotificationsContextType {
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

const NotificationsContext = createContext<NotificationsContextType | null>(
  null
);

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used within a NotificationsProvider"
    );
  }
  return context;
};

interface NotificationsProviderProps {
  children: ReactNode;
}

export const NotificationsProvider: React.FC<NotificationsProviderProps> = ({
  children,
}) => {
  const [notifications, setNotifications] = useState<INotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { currentUser } = useAuth();

  // Calculate unread count
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const addNotification = useCallback((notification: INotification) => {
    console.log("[NOTIFICATIONS] Adding new notification:", notification);
    setNotifications((prev) => {
      // Prevent duplicate notifications
      if (prev.some((n) => n._id === notification._id)) {
        return prev;
      }
      const newNotifications = [...prev, notification];
      console.log("[NOTIFICATIONS] Updated notifications:", newNotifications);
      return newNotifications;
    });
  }, []);

  const removeNotification = useCallback(async (notificationId: string) => {
    console.log("[NOTIFICATIONS] Removing notification:", notificationId);

    // Validate the notification ID
    if (
      !notificationId ||
      typeof notificationId !== "string" ||
      notificationId.trim() === ""
    ) {
      console.error(
        "[NOTIFICATIONS] Invalid notification ID provided:",
        notificationId
      );
      setError("Invalid notification ID provided");
      return;
    }

    // Check if it's a valid MongoDB ObjectId (24 character hex string)
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    if (!objectIdRegex.test(notificationId)) {
      console.error("[NOTIFICATIONS] Invalid ObjectId format:", notificationId);
      setError("Invalid notification ID format");
      return;
    }

    try {
      const { request } = notificationService.deleteById(notificationId);
      await request;
      setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
      console.log(
        "[NOTIFICATIONS] Successfully removed notification:",
        notificationId
      );
    } catch (err) {
      if (err instanceof CanceledError) return;
      console.error("[NOTIFICATIONS] Error removing notification:", err);
      setError(err.message);
    }
  }, []);

  const markAsRead = useCallback(
    async (notificationId: string) => {
      if (!notificationId || !currentUser?._id) return;

      try {
        const { request } = notificationService.markAsRead(notificationId);
        await request;
        setNotifications((prev) =>
          prev.map((n) =>
            n._id === notificationId ? { ...n, isRead: true } : n
          )
        );
        console.log(
          "[NOTIFICATIONS] Marked notification as read:",
          notificationId
        );
      } catch (err) {
        if (err instanceof CanceledError) return;
        console.error(
          "[NOTIFICATIONS] Error marking notification as read:",
          err
        );
        setError(err.message);
      }
    },
    [currentUser?._id]
  );

  const markAllAsRead = useCallback(async () => {
    if (!currentUser?._id) return;

    try {
      const { request } = notificationService.markAllAsRead(currentUser._id);
      await request;
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      console.log("[NOTIFICATIONS] Marked all notifications as read");
    } catch (err) {
      if (err instanceof CanceledError) return;
      console.error(
        "[NOTIFICATIONS] Error marking all notifications as read:",
        err
      );
      setError(err.message);
    }
  }, [currentUser?._id]);

  const clearNotifications = useCallback(() => {
    console.log("[NOTIFICATIONS] Clearing all notifications");
    // Only clear from local state, as there's no bulk delete API
    setNotifications([]);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?._id) return;

    setIsLoading(true);
    setError(null);

    const { request } = notificationService.getAllByUserId(currentUser._id);

    try {
      const response = await request;
      console.log(
        "[NOTIFICATIONS] Successfully fetched notifications:",
        response.data
      );
      setNotifications(response.data.data); // Updated to match backend response structure
    } catch (err) {
      if (err instanceof CanceledError) return;

      // More detailed error handling
      if (err.response) {
        // Server responded with error status
        const statusCode = err.response.status;
        const errorMessage =
          err.response.data?.error ||
          err.response.data ||
          "Unknown server error";
        console.error(
          `[NOTIFICATIONS] Server error ${statusCode}:`,
          errorMessage
        );
        setError(`Server error (${statusCode}): ${errorMessage}`);
      } else if (err.request) {
        // Request was made but no response received
        console.error(
          "[NOTIFICATIONS] Network error - no response received:",
          err.request
        );
        setError("Network error: Unable to connect to server");
      } else {
        // Something else happened
        console.error("[NOTIFICATIONS] Error setting up request:", err.message);
        setError(`Request error: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?._id]);

  // Initial fetch of notifications
  useEffect(() => {
    if (currentUser?._id) {
      fetchNotifications();
    }
  }, [currentUser?._id, fetchNotifications]);

  // Socket notification listeners
  useEffect(() => {
    if (!currentUser?._id) return;

    console.log("[NOTIFICATIONS] Setting up socket notification listeners");

    const handleMatchNotification = (notification: INotification) => {
      console.log("[NOTIFICATIONS] Match notification received:", notification);
      if (notification.userId === currentUser._id) {
        addNotification(notification);
      }
    };

    // Connect socket if not already connected
    socketService.connect(currentUser._id);
    socketService.onMatchNotification(handleMatchNotification);

    return () => {
      console.log("[NOTIFICATIONS] Cleaning up socket notification listeners");
      socketService.offMatchNotification(handleMatchNotification);
    };
  }, [currentUser?._id, addNotification]);

  // Log when notifications change
  useEffect(() => {
    console.log("[NOTIFICATIONS] Current notifications:", notifications);
  }, [notifications]);

  const value = {
    notifications,
    error,
    isLoading,
    addNotification,
    removeNotification,
    clearNotifications,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    unreadCount,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};
