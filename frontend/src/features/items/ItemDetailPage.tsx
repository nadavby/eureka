import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/states";
import { NotFoundPage } from "@/app/NotFoundPage";
import { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import { tagNumber } from "@/lib/format";
import { COLORS, isKnownCategory } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import type { Match } from "@/lib/types";
import { useSession } from "@/features/auth/session";
import { PinMap } from "@/features/map/PinMap";
import { sides, useMyMatches } from "@/features/matches/api";
import { useDeleteItem, useItem } from "./hooks";
import { StatusChip } from "./StatusChip";
import { useItemTitle } from "./title";
import axios from "axios";

const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="grid grid-cols-[8rem_1fr] gap-3 py-2 text-sm">
    <dt className="text-muted-foreground">{label}</dt>
    <dd>{children}</dd>
  </div>
);

const MatchRow = ({ match }: { match: Match }) => {
  const { t } = useTranslation();
  const { userId } = useSession();
  const { otherItemId, iConfirmed, theyConfirmed } = sides(match, userId);
  const other = useItem(otherItemId);
  const title = useItemTitle();
  const state = match.confirmedAt ? "confirmed" : iConfirmed ? "waiting" : theyConfirmed ? "theyConfirmed" : "new";
  return (
    <li>
      <Link
        to={`/matches/${match._id}`}
        className="flex items-center gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {other.data ? (
          <img src={other.data.imageUrl} alt="" className="size-14 shrink-0 rounded-md object-cover" />
        ) : (
          <Skeleton className="size-14 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {other.data ? title(other.data) : "…"}{" "}
            <span className="font-mono text-xs text-muted-foreground">{tagNumber(otherItemId)}</span>
          </p>
          <p className="text-xs text-muted-foreground">{t(`match.state.${state}`)}</p>
        </div>
        <span className="rounded-full bg-manila px-2.5 py-1 font-mono text-sm text-manila-foreground">{match.matchScore}%</span>
        <ChevronRight className="size-4 text-muted-foreground rtl:-scale-x-100" />
      </Link>
    </li>
  );
};

export const ItemDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { userId } = useSession();
  const item = useItem(id);
  const matches = useMyMatches();
  const remove = useDeleteItem();
  const title = useItemTitle();
  const lng = i18n.resolvedLanguage ?? "en";

  if (item.isPending) {
    return (
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-8 md:grid-cols-2">
        <Skeleton className="aspect-[4/3]" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }
  if (item.isError) {
    if (axios.isAxiosError(item.error) && item.error.response?.status === 404) return <NotFoundPage />;
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <ErrorState message={errorMessage(item.error, t("auth.networkError"))} onRetry={() => void item.refetch()} />
      </div>
    );
  }

  const data = item.data;
  const isMine = data.userId === userId;
  const itemMatches = (matches.data ?? []).filter((m) => m.item1Id === data._id || m.item2Id === data._id);
  const a = data.attributes;

  const onDelete = async () => {
    try {
      await remove.mutateAsync(data._id);
      toast.success(t("item.deleted"));
      navigate("/items/mine", { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, t("item.deleteFailed")));
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="grid gap-8 md:grid-cols-2">
        <div className="self-start overflow-hidden rounded-xl border bg-card">
          <div className="relative flex items-center gap-2 bg-manila px-4 pb-3 pt-7 text-manila-foreground [clip-path:polygon(16px_0,calc(100%-16px)_0,100%_16px,100%_100%,0_100%,0_16px)]">
            <span aria-hidden className="absolute left-1/2 top-2.5 size-3.5 -translate-x-1/2 rounded-full bg-background ring-2 ring-manila-edge" />
            <span dir="ltr" className="font-mono text-sm tracking-wider [unicode-bidi:isolate]">
              {tagNumber(data._id)}
            </span>
            <span
              className={cn(
                "ms-auto -rotate-6 rounded-[3px] border-2 bg-card/70 px-2 py-0.5 font-mono text-xs uppercase tracking-widest",
                data.itemType === "lost" ? "border-lost text-lost" : "border-found text-found"
              )}
            >
              {t(`tag.${data.itemType}`)}
            </span>
          </div>
          <img src={data.imageUrl} alt={title(data)} className="aspect-[4/3] w-full bg-muted object-cover" />
        </div>

        <div>
          <div className="flex flex-wrap items-start gap-3">
            <h1 className="flex-1 text-2xl font-bold sm:text-3xl">{title(data)}</h1>
            {isMine && <StatusChip item={data} />}
          </div>
          {(a?.description || data.description) && (
            <p className="mt-3 text-muted-foreground">{data.description || a?.description}</p>
          )}

          <dl className="mt-5 divide-y border-y">
            <Fact label={t("item.category")}>
              {isKnownCategory(data.category) ? t(`categories.${data.category}`) : data.category}
            </Fact>
            <Fact label={t(`item.date.${data.itemType}`)}>
              <span className="font-mono">{formatDate(data.date, lng)}</span>
            </Fact>
            {data.placeName && <Fact label={t("item.place")}>{data.placeName}</Fact>}
            {data.colors.length > 0 && (
              <Fact label={t("report.colors")}>
                <span className="flex flex-wrap gap-2">
                  {data.colors.map((c) => {
                    const swatch = COLORS.find((x) => x.value === c);
                    return (
                      <span key={c} className="inline-flex items-center gap-1.5">
                        {swatch && <span aria-hidden className="size-3 rounded-full border border-black/15" style={{ background: swatch.hex }} />}
                        {swatch ? t(`colors.${c}`) : c}
                      </span>
                    );
                  })}
                </span>
              </Fact>
            )}
            {(data.brand || a?.brand) && <Fact label={t("item.brand")}>{data.brand || a?.brand}</Fact>}
            {a && a.distinctiveFeatures.length > 0 && (
              <Fact label={t("item.features")}>
                <ul className="list-inside list-disc space-y-0.5">
                  {a.distinctiveFeatures.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </Fact>
            )}
            {a && a.visibleText.length > 0 && (
              <Fact label={t("item.visibleText")}>
                <span className="font-mono text-xs">{a.visibleText.join(" · ")}</span>
              </Fact>
            )}
          </dl>
          {a && <p className="mt-2 text-xs text-muted-foreground">{t("item.aiNote")}</p>}

          <div className="mt-5">
            <PinMap lat={data.location.lat} lng={data.location.lng} itemType={data.itemType} />
          </div>
        </div>
      </div>

      {isMine ? (
        <section className="mt-10" aria-labelledby="matches-heading">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="matches-heading" className="text-xl font-bold">
              {t("item.matchesTitle")}
            </h2>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive">
                  <Trash2 /> {t("item.delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("item.deleteTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>{t("item.deleteBody")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void onDelete()} className="bg-destructive text-white hover:bg-destructive/90">
                    {t("item.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          {itemMatches.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {itemMatches.map((m) => (
                <MatchRow key={m._id} match={m} />
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              {data.matchingStatus === "done" ? t("item.noMatches") : t("item.searching")}
            </p>
          )}
        </section>
      ) : (
        <section className="mt-10 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-bold">{t(`item.isItYours.${data.itemType}`)}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t(`item.isItYoursBody.${data.itemType}`)}</p>
          <Button asChild className="mt-4">
            <Link to={`/report/${data.itemType === "found" ? "lost" : "found"}`}>
              {data.itemType === "found" ? t("nav.reportLost") : t("nav.reportFound")}
            </Link>
          </Button>
        </section>
      )}
    </div>
  );
};
