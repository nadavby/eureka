import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";
import { notificationSocket } from "@/lib/socket";
import { formatRelative } from "@/lib/dates";
import { cn } from "@/lib/utils";
import type { AppNotification } from "@/lib/types";
import { useSession } from "@/features/auth/session";

const KEY = ["notifications"] as const;

export const NotificationsBell = () => {
  const { t, i18n } = useTranslation();
  const { userId } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const list = useQuery({
    queryKey: KEY,
    queryFn: async () => (await api.get<{ data: AppNotification[] }>("/notification")).data.data,
    enabled: !!userId,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.put(`/notification/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
  const markAll = useMutation({
    mutationFn: () => api.put("/notification/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  // A new match arrives over the socket: refresh the list and say so.
  useEffect(() => {
    if (!userId) return;
    const socket = notificationSocket();
    const onMatch = (n: AppNotification) => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ["matches"] });
      toast(t("notifications.newMatch"), {
        description: t("notifications.newMatchBody"),
        action: { label: t("notifications.view"), onClick: () => navigate(`/matches/${n.matchId}`) },
      });
    };
    socket.on("match_notification", onMatch);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off("match_notification", onMatch);
    };
  }, [userId, queryClient, navigate, t]);

  const items = list.data ?? [];
  const unread = items.filter((n) => !n.isRead).length;
  const lng = i18n.resolvedLanguage ?? "en";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={unread ? t("notifications.labelUnread", { count: unread }) : t("nav.notifications")}
        >
          <Bell />
          {unread > 0 && (
            <span className="absolute end-1 top-1 grid min-w-4 place-items-center rounded-full bg-lost px-1 font-mono text-[10px] leading-4 text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="font-medium">{t("nav.notifications")}</p>
          {unread > 0 && (
            <Button variant="link" size="sm" className="h-auto p-0" onClick={() => markAll.mutate()}>
              {t("notifications.markAll")}
            </Button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t("notifications.empty")}</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto">
            {items.map((n) => (
              <li key={n._id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.isRead) markRead.mutate(n._id);
                    navigate(`/matches/${n.matchId}`);
                  }}
                  className={cn(
                    "flex w-full gap-3 px-4 py-3 text-start transition-colors hover:bg-secondary/60 focus-visible:bg-secondary focus-visible:outline-none",
                    !n.isRead && "bg-primary/5"
                  )}
                >
                  <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.isRead ? "bg-transparent" : "bg-primary")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{t("notifications.newMatch")}</span>
                    <span className="block text-xs text-muted-foreground">{formatRelative(n.createdAt, lng)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};
