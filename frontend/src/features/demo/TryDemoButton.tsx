import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Loader2, PlayCircle } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { api, errorCode } from "@/lib/api";
import { useSession } from "@/features/auth/session";

/** Starts a private demo sandbox and opens its ready-made match. */
export const TryDemoButton = ({
  variant = "secondary",
  size = "lg",
  className,
}: VariantProps<typeof buttonVariants> & { className?: string }) => {
  const { t } = useTranslation();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  const start = async () => {
    setStarting(true);
    try {
      const { data } = await api.post<{ accessToken: string; refreshToken: string; matchId: string }>("/auth/demo");
      signIn(data.accessToken, data.refreshToken);
      navigate(`/matches/${data.matchId}`);
    } catch (err) {
      const code = errorCode(err);
      toast.error(code === "DEMO_BUSY" || code === "DEMO_UNAVAILABLE" ? t(`demo.${code}`) : t("auth.networkError"));
      setStarting(false);
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={() => void start()} disabled={starting}>
      {starting ? <Loader2 className="animate-spin" /> : <PlayCircle />}
      {t("demo.try")}
    </Button>
  );
};
