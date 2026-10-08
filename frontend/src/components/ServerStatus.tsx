import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useServerWarmup } from "@/lib/warmup";

/** Explains the free-tier cold start instead of letting the first click look broken. */
export const ServerStatus = () => {
  const { t } = useTranslation();
  const state = useServerWarmup();
  if (state !== "waking" && state !== "down") return null;
  return (
    <p role="status" className="inline-flex items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
      {state === "waking" && <Loader2 className="size-3.5 animate-spin" />}
      {state === "waking" ? t("server.waking") : t("server.down")}
    </p>
  );
};
