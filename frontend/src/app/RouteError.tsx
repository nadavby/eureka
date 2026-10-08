import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

/** Shown when a screen crashes, instead of a blank page. */
export const RouteError = () => {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
      <h1 className="text-2xl font-bold">{t("common.somethingWrong")}</h1>
      <Button className="mt-6" onClick={() => window.location.reload()}>
        {t("common.retry")}
      </Button>
    </div>
  );
};
