import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import axios from "axios";
import { Check, Mail, MessageCircle, Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { ClaimTag } from "@/components/claim-tag/ClaimTag";
import { TiedTags } from "@/components/claim-tag/TiedTags";
import { ErrorState } from "@/components/states";
import { NotFoundPage } from "@/app/NotFoundPage";
import { errorMessage } from "@/lib/api";
import { formatDate } from "@/lib/dates";
import type { Item } from "@/lib/types";
import { useSession } from "@/features/auth/session";
import { useItem } from "@/features/items/hooks";
import { useItemTitle } from "@/features/items/title";
import { sides, useConfirmMatch, useMatch, useRejectMatch, useUser } from "./api";

const TagFor = ({ item }: { item: Item }) => {
  const { i18n } = useTranslation();
  const title = useItemTitle();
  return (
    <ClaimTag
      id={item._id}
      itemType={item.itemType}
      imageUrl={item.imageUrl}
      title={title(item)}
      meta={
        <span className="flex flex-col gap-0.5">
          {item.placeName && <span className="line-clamp-1" dir="auto">{item.placeName}</span>}
          <span className="font-mono">{formatDate(item.date, i18n.resolvedLanguage ?? "en")}</span>
        </span>
      }
    />
  );
};

export const MatchPage = () => {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userId } = useSession();
  const match = useMatch(id);
  const s = match.data ? sides(match.data, userId) : null;
  const mine = useItem(s?.myItemId);
  const theirs = useItem(s?.otherItemId);
  const other = useUser(s?.otherUserId);
  const confirm = useConfirmMatch();
  const reject = useRejectMatch();

  if (match.isError) {
    const status = axios.isAxiosError(match.error) ? match.error.response?.status : undefined;
    if (status === 404 || status === 403) return <NotFoundPage />;
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <ErrorState message={errorMessage(match.error, t("auth.networkError"))} onRetry={() => void match.refetch()} />
      </div>
    );
  }

  const ready = match.data && mine.data && theirs.data && s;
  const [lost, found] = ready ? (mine.data!.itemType === "lost" ? [mine.data!, theirs.data!] : [theirs.data!, mine.data!]) : [];
  const m = match.data;

  const onConfirm = async () => {
    try {
      const res = await confirm.mutateAsync(m!._id);
      toast.success(res.status === "FULLY_CONFIRMED" ? t("match.bothConfirmedToast") : t("match.confirmedToast"));
    } catch (err) {
      toast.error(errorMessage(err, t("match.actionFailed")));
    }
  };
  const onReject = async () => {
    try {
      await reject.mutateAsync(m!._id);
      toast.success(t("match.rejectedToast"));
      navigate(`/items/${s!.myItemId}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, t("match.actionFailed")));
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {match.data?.confirmedAt ? t("match.kickerConfirmed") : t("match.kicker")}
      </p>
      <h1 className="text-2xl font-bold sm:text-3xl">{match.data?.confirmedAt ? t("match.titleConfirmed") : t("match.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{match.data?.confirmedAt ? t("match.leadConfirmed") : t("match.lead")}</p>

      <div className="mt-16 sm:mt-20">
        {ready ? (
          <TiedTags score={m!.matchScore} left={<TagFor item={lost!} />} right={<TagFor item={found!} />} />
        ) : (
          <div className="grid grid-cols-2 gap-8">
            <Skeleton className="aspect-[3/4]" />
            <Skeleton className="aspect-[3/4]" />
          </div>
        )}
      </div>

      {m && (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <section aria-labelledby="why" className="rounded-xl border bg-card p-5">
            <h2 id="why" className="font-sans text-base font-semibold tracking-normal">
              {t("match.why")}
            </h2>
            {m.reasons.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm">
                {m.reasons.map((r) => (
                  <li key={r} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-found" aria-hidden /> <span dir="auto">{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t("match.noReasons")}</p>
            )}
            {m.conflicts.length > 0 && (
              <>
                <h3 className="mt-5 font-sans text-sm font-semibold tracking-normal">{t("match.differences")}</h3>
                <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                  {m.conflicts.map((c) => (
                    <li key={c} className="flex gap-2">
                      <X className="mt-0.5 size-4 shrink-0 text-lost" aria-hidden /> <span dir="auto">{c}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section aria-labelledby="next" className="rounded-xl border bg-card p-5">
            <h2 id="next" className="font-sans text-base font-semibold tracking-normal">
              {m.confirmedAt ? t("match.doneTitle") : t("match.nextTitle")}
            </h2>

            {m.confirmedAt ? (
              <>
                <p className="mt-2 text-sm text-muted-foreground">{t("match.doneBody", { name: other.data?.userName ?? "" })}</p>
                {other.data && (
                  <ul className="mt-4 space-y-2 text-sm">
                    {other.data.email && (
                      <li>
                        <a href={`mailto:${other.data.email}`} className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline" dir="ltr">
                          <Mail className="size-4" /> {other.data.email}
                        </a>
                      </li>
                    )}
                    {other.data.phoneNumber?.trim() && (
                      <li>
                        <a href={`tel:${other.data.phoneNumber}`} className="inline-flex items-center gap-2 text-primary underline-offset-4 hover:underline" dir="ltr">
                          <Phone className="size-4" /> {other.data.phoneNumber}
                        </a>
                      </li>
                    )}
                  </ul>
                )}
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-muted-foreground">
                  {s?.iConfirmed ? t("match.waitingForThem") : s?.theyConfirmed ? t("match.theyConfirmed") : t("match.nextBody")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {!s?.iConfirmed && (
                    <Button onClick={() => void onConfirm()} disabled={confirm.isPending}>
                      <Check /> {t("match.confirm")}
                    </Button>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline">
                        <X /> {t("match.reject")}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t("match.rejectTitle")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("match.rejectBody")}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void onReject()}>{t("match.reject")}</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </>
            )}

            <Button asChild variant="secondary" className="mt-5 w-full">
              <Link to={`/chats/${m._id}`}>
                <MessageCircle /> {t("match.openChat", { name: other.data?.userName ?? "" })}
              </Link>
            </Button>
          </section>
        </div>
      )}
    </div>
  );
};
