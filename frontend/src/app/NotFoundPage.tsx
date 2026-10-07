import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

export const NotFoundPage = () => {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <span className="-rotate-6 rounded-[4px] border-2 border-lost px-3 py-1 font-mono text-sm uppercase tracking-widest text-lost">
        404
      </span>
      <h1 className="mt-6 text-2xl font-bold">{t("common.notFoundTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("common.notFoundBody")}</p>
      <Button asChild className="mt-8">
        <Link to="/">{t("common.goHome")}</Link>
      </Button>
    </div>
  );
};
