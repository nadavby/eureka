import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/** An empty list is an invitation to act: say what's missing and offer the next step. */
export const EmptyState = ({ title, body, action }: { title: string; body?: string; action?: ReactNode }) => (
  <div className="flex flex-col items-center rounded-xl border border-dashed bg-card/40 px-6 py-16 text-center">
    <span aria-hidden className="mb-4 grid h-10 w-14 place-items-center rounded-md bg-manila [clip-path:polygon(8px_0,calc(100%-8px)_0,100%_8px,100%_100%,0_100%,0_8px)]">
      <span className="size-2 rounded-full bg-background" />
    </span>
    <h2 className="text-lg font-semibold">{title}</h2>
    {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
    {action && <div className="mt-6">{action}</div>}
  </div>
);

export const ErrorState = ({ message, onRetry }: { message?: string; onRetry?: () => void }) => {
  const { t } = useTranslation();
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
      <h2 className="text-lg font-semibold">{t("common.somethingWrong")}</h2>
      {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
      {onRetry && (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
};

export const TagGridSkeleton = ({ count = 8 }: { count?: number }) => (
  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" aria-hidden>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="overflow-hidden rounded-lg border bg-card">
        <Skeleton className="h-11 rounded-none" />
        <Skeleton className="aspect-[4/3] rounded-none" />
        <div className="space-y-2 p-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export const PageHeader = ({ title, lead, actions }: { title: string; lead?: string; actions?: ReactNode }) => (
  <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {lead && <p className="mt-1 text-sm text-muted-foreground">{lead}</p>}
    </div>
    {actions}
  </div>
);
