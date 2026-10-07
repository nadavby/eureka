import { useTranslation } from "react-i18next";
import { AlertTriangle, CheckCircle2, Loader2, ScanSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Item } from "@/lib/types";

/** Live matching progress for one of the user's own items. */
export const StatusChip = ({ item, className }: { item: Pick<Item, "matchingStatus" | "matchCount" | "isResolved">; className?: string }) => {
  const { t } = useTranslation();
  const base = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium";

  if (item.isResolved) {
    return (
      <span className={cn(base, "bg-found/10 text-found", className)}>
        <CheckCircle2 className="size-3.5" /> {t("status.resolved")}
      </span>
    );
  }
  switch (item.matchingStatus) {
    case "analyzing":
    case "searching":
      return (
        <span className={cn(base, "bg-primary/10 text-primary", className)} role="status">
          {item.matchingStatus === "analyzing" ? (
            <Loader2 className="size-3.5 motion-safe:animate-spin" />
          ) : (
            <ScanSearch className="size-3.5 motion-safe:animate-pulse" />
          )}
          {t(`status.${item.matchingStatus}`)}
        </span>
      );
    case "failed":
      return (
        <span className={cn(base, "bg-destructive/10 text-destructive", className)}>
          <AlertTriangle className="size-3.5" /> {t("status.failed")}
        </span>
      );
    default:
      return item.matchCount > 0 ? (
        <span className={cn(base, "bg-manila text-manila-foreground", className)}>
          {t("status.matches", { count: item.matchCount })}
        </span>
      ) : (
        <span className={cn(base, "bg-muted text-muted-foreground", className)}>{t("status.noMatch")}</span>
      );
  }
};
