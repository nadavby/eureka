import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, CheckCheck, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/dates";
import { tagNumber } from "@/lib/format";
import type { Match } from "@/lib/types";
import { useSession } from "@/features/auth/session";
import { useItem } from "@/features/items/hooks";
import { useItemTitle } from "@/features/items/title";
import { sides, useMatch, useMyMatches, useUser } from "@/features/matches/api";
import { useChatThread } from "./useChatThread";

const initials = (name?: string) => (name ?? "?").trim().slice(0, 2).toUpperCase();

const ConversationRow = ({ match }: { match: Match }) => {
  const { userId } = useSession();
  const s = sides(match, userId);
  const other = useUser(s.otherUserId);
  const item = useItem(s.myItemId);
  const title = useItemTitle();
  return (
    <NavLink
      to={`/chats/${match._id}`}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive ? "bg-secondary" : "hover:bg-secondary/60"
        )
      }
    >
      <Avatar className="size-10">
        {other.data?.imgURL && <AvatarImage src={other.data.imgURL} alt="" />}
        <AvatarFallback>{initials(other.data?.userName)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{other.data?.userName ?? "…"}</p>
        <p className="truncate text-xs text-muted-foreground">
          {item.data ? title(item.data) : ""} <span className="font-mono">{tagNumber(s.myItemId)}</span>
        </p>
      </div>
      <span className="rounded-full bg-manila px-2 py-0.5 font-mono text-xs text-manila-foreground">{match.matchScore}%</span>
    </NavLink>
  );
};

const Thread = ({ matchId }: { matchId: string }) => {
  const { t, i18n } = useTranslation();
  const { userId } = useSession();
  const match = useMatch(matchId);
  const s = match.data ? sides(match.data, userId) : null;
  const other = useUser(s?.otherUserId);
  const { messages, loaded, error, send } = useChatThread(matchId);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lng = i18n.resolvedLanguage ?? "en";
  const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send(draft);
    setDraft("");
  };

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={t("chat.thread")}>
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <Button asChild variant="ghost" size="icon" className="md:hidden" aria-label={t("common.back")}>
          <Link to="/chats">
            <BackIcon />
          </Link>
        </Button>
        <Avatar className="size-9">
          {other.data?.imgURL && <AvatarImage src={other.data.imgURL} alt="" />}
          <AvatarFallback>{initials(other.data?.userName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{other.data?.userName ?? "…"}</p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to={`/matches/${matchId}`}>{t("chat.viewMatch")}</Link>
        </Button>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4" aria-live="polite">
        {!loaded && !error && (
          <div className="space-y-2">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="ms-auto h-9 w-1/2" />
          </div>
        )}
        {error && <p className="text-center text-sm text-destructive">{error}</p>}
        {loaded && messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{t("chat.emptyThread")}</p>}
        {messages.map((m) => {
          const mine = m.senderId === userId;
          return (
            <div key={m._id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm",
                  mine ? "rounded-ee-sm bg-primary text-primary-foreground" : "rounded-es-sm bg-secondary",
                  m.pending && "opacity-70"
                )}
              >
                <p className="whitespace-pre-wrap break-words" dir="auto">{m.content}</p>
                <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                  {formatRelative(m.timestamp, lng)}
                  {mine &&
                    (m.status === "read" ? (
                      <CheckCheck className="size-3" aria-label={t("chat.read")} />
                    ) : (
                      <Check className="size-3" aria-label={t("chat.sent")} />
                    ))}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t("chat.placeholder")}
          aria-label={t("chat.placeholder")}
          maxLength={2000}
          autoComplete="off"
        />
        <Button type="submit" size="icon" disabled={!draft.trim()} aria-label={t("chat.send")}>
          <Send className="rtl:-scale-x-100" />
        </Button>
      </form>
    </section>
  );
};

export const ChatsPage = () => {
  const { t } = useTranslation();
  const { matchId } = useParams<{ matchId: string }>();
  const matches = useMyMatches();
  const list = matches.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-0 py-0 sm:px-4 sm:py-6">
      <div className="grid h-[calc(100dvh-3.5rem)] overflow-hidden border-y bg-card sm:h-[calc(100dvh-6.5rem)] sm:rounded-xl sm:border md:grid-cols-[18rem_1fr]">
        <aside className={cn("min-h-0 overflow-y-auto border-e p-2", matchId && "hidden md:block")} aria-label={t("chat.conversations")}>
          <h1 className="px-3 py-2 text-lg font-bold">{t("nav.chats")}</h1>
          {matches.isPending ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : list.length === 0 ? (
            <p className="px-3 py-6 text-sm text-muted-foreground">{t("chat.noConversations")}</p>
          ) : (
            <nav className="space-y-1">
              {list.map((m) => (
                <ConversationRow key={m._id} match={m} />
              ))}
            </nav>
          )}
        </aside>
        <div className={cn("min-h-0", !matchId && "hidden md:block")}>
          {matchId ? (
            <Thread key={matchId} matchId={matchId} />
          ) : (
            <div className="grid h-full place-items-center p-6">
              <EmptyState title={t("chat.pickTitle")} body={t("chat.pickBody")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
