import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorCode } from "@/lib/api";
import { googleSignIn, login } from "./api";
import { AuthLayout } from "./AuthLayout";
import { GoogleButton } from "./GoogleButton";
import { useSession } from "./session";

const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
type FormValues = z.infer<typeof schema>;

export const LoginPage = () => {
  const { t } = useTranslation();
  const { userId, signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/items";
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (userId) return <Navigate to={from} replace />;

  const finish = (res: { accessToken: string; refreshToken: string }) => {
    signIn(res.accessToken, res.refreshToken);
    navigate(from, { replace: true });
  };

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      finish(await login(email, password));
    } catch (err) {
      setError(errorCode(err) === "INVALID_CREDENTIALS" ? t("auth.invalidCredentials") : t("auth.networkError"));
    }
  });

  return (
    <AuthLayout
      title={t("auth.loginTitle")}
      lead={t("auth.loginLead")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link to="/register" state={{ from }} className="font-medium text-primary underline-offset-4 hover:underline">
            {t("nav.signUp")}
          </Link>
        </>
      }
    >
      {notice && (
        <Alert className="mb-4">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" autoComplete="email" dir="ltr" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
          {form.formState.errors.email && <p className="text-xs text-destructive">{t("auth.errors.email")}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" autoComplete="current-password" dir="ltr" {...form.register("password")} />
        </div>
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          {t("auth.submitLogin")}
        </Button>
      </form>
      <GoogleButton
        onCredential={async (credential) => {
          try {
            finish(await googleSignIn(credential));
          } catch {
            setError(t("auth.googleFailed"));
          }
        }}
        onError={() => setError(t("auth.googleFailed"))}
      />
    </AuthLayout>
  );
};
