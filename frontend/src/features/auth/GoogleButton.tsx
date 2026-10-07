import { GoogleLogin } from "@react-oauth/google";
import { useTranslation } from "react-i18next";
import { env } from "@/lib/env";

/** Renders nothing when no Google client id is configured. */
export const GoogleButton = ({ onCredential, onError }: { onCredential: (credential: string) => void; onError: () => void }) => {
  const { t, i18n } = useTranslation();
  if (!env.googleClientId) return null;
  return (
    <>
      <div className="my-5 flex items-center gap-3 text-xs uppercase text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("auth.or")}
        <span className="h-px flex-1 bg-border" />
      </div>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={(res) => (res.credential ? onCredential(res.credential) : onError())}
          onError={onError}
          locale={i18n.resolvedLanguage}
          width="320"
        />
      </div>
    </>
  );
};
