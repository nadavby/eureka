import { useCallback, useEffect, useState } from "react";
import { chatSocket } from "@/lib/socket";
import type { ChatMessage } from "@/lib/types";
import { useSession } from "@/features/auth/session";

type Pending = ChatMessage & { pending?: true };

/**
 * One conversation over the authenticated /chat socket: history on join, live messages,
 * delivered/read receipts, and optimistic sending (replaced when the server echoes it back).
 */
export const useChatThread = (matchId: string | undefined) => {
  const { userId } = useSession();
  const [messages, setMessages] = useState<Pending[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!matchId || !userId) return;
    const socket = chatSocket();
    setMessages([]);
    setLoaded(false);
    setError(null);

    const join = () => socket.emit("join_chat", matchId);
    const onHistory = (history: ChatMessage[]) => {
      setMessages(history);
      setLoaded(true);
    };
    const onMessage = (msg: ChatMessage) => {
      if (msg.matchId !== matchId) return;
      setMessages((prev) => {
        // replace the optimistic copy of my own message, if any
        const i = prev.findIndex((m) => m.pending && m.senderId === msg.senderId && m.content === msg.content);
        if (i >= 0) return [...prev.slice(0, i), msg, ...prev.slice(i + 1)];
        return prev.some((m) => m._id === msg._id) ? prev : [...prev, msg];
      });
    };
    const onStatus = ({ messageId, status }: { messageId: string; status: ChatMessage["status"] }) =>
      setMessages((prev) => prev.map((m) => (m._id === messageId ? { ...m, status } : m)));
    const onError = (e: { message: string }) => setError(e.message);

    socket.on("connect", join);
    socket.on("chat_history", onHistory);
    socket.on("new_message", onMessage);
    socket.on("message_status_updated", onStatus);
    socket.on("error", onError);
    if (socket.connected) join();
    else socket.connect();

    return () => {
      socket.emit("leave_chat", matchId);
      socket.off("connect", join);
      socket.off("chat_history", onHistory);
      socket.off("new_message", onMessage);
      socket.off("message_status_updated", onStatus);
      socket.off("error", onError);
    };
  }, [matchId, userId]);

  // Mark messages addressed to me as read while the thread is open.
  useEffect(() => {
    if (!userId || document.hidden) return;
    const socket = chatSocket();
    for (const m of messages) {
      if (m.receiverId === userId && m.status !== "read" && !m.pending) {
        socket.emit("update_message_status", { messageId: m._id, status: "read" });
      }
    }
  }, [messages, userId]);

  const send = useCallback(
    (content: string) => {
      const text = content.trim();
      if (!text || !matchId || !userId) return;
      setMessages((prev) => [
        ...prev,
        {
          _id: `pending-${Date.now()}`,
          matchId,
          senderId: userId,
          receiverId: "",
          content: text,
          timestamp: new Date().toISOString(),
          status: "sent",
          pending: true,
        },
      ]);
      chatSocket().emit("send_message", { matchId, content: text });
    },
    [matchId, userId]
  );

  return { messages, loaded, error, send };
};
