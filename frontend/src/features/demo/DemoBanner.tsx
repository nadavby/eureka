import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { useSession } from "@/features/auth/session";

/** Tells demo visitors where they are, and how to leave. */
export const DemoBanner = () => {
  const { t } = useTranslation();
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  if (user?.demoRole !== "visitor") return null;
  return (
    <div className="border-b bg-manila text-manila-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <p className="flex-1">{t("demo.banner")}</p>
        <button
          type="button"
          className="font-medium underline underline-offset-4"
          onClick={async () => {
            await signOut();
            navigate("/");
          }}
        >
          {t("demo.leave")}
        </button>
      </div>
    </div>
  );
};
