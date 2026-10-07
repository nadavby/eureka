import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorMessage } from "@/lib/api";
import { downscaleImage } from "@/lib/images";
import { login, register, uploadAvatar } from "./api";
import { AuthLayout } from "./AuthLayout";
import { useSession } from "./session";

const schema = z.object({
  userName: z.string().trim().min(2).max(40),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128),
  phoneNumber: z.string().trim().min(6).max(20),
  avatar: z.custom<FileList>().optional(),
});
type FormValues = z.infer<typeof schema>;

export const RegisterPage = () => {
  const { t } = useTranslation();
  const { signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/items";
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });
  const errors = form.formState.errors;

  const onSubmit = form.handleSubmit(async ({ avatar, ...values }) => {
    setError(null);
    try {
      const file = avatar?.[0];
      const imgURL = file ? await uploadAvatar(await downscaleImage(file, 512)) : null;
      await register({ ...values, imgURL });
      const session = await login(values.email, values.password);
      signIn(session.accessToken, session.refreshToken);
      navigate(from, { replace: true });
    } catch (err) {
      setError(errorMessage(err, t("auth.networkError")));
    }
  });

  return (
    <AuthLayout
      title={t("auth.registerTitle")}
      lead={t("auth.registerLead")}
      footer={
        <>
          {t("auth.haveAccount")}{" "}
          <Link to="/login" state={{ from }} className="font-medium text-primary underline-offset-4 hover:underline">
            {t("nav.signIn")}
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="userName">{t("auth.userName")}</Label>
          <Input id="userName" autoComplete="name" {...form.register("userName")} aria-invalid={!!errors.userName} />
          {errors.userName && <p className="text-xs text-destructive">{t("auth.errors.userName")}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input id="email" type="email" autoComplete="email" dir="ltr" {...form.register("email")} aria-invalid={!!errors.email} />
          {errors.email && <p className="text-xs text-destructive">{t("auth.errors.email")}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input id="password" type="password" autoComplete="new-password" dir="ltr" aria-describedby="password-hint" {...form.register("password")} aria-invalid={!!errors.password} />
          <p id="password-hint" className={errors.password ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {errors.password ? t("auth.errors.password") : t("auth.passwordHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="phoneNumber">{t("auth.phone")}</Label>
          <Input id="phoneNumber" type="tel" autoComplete="tel" dir="ltr" aria-describedby="phone-hint" {...form.register("phoneNumber")} aria-invalid={!!errors.phoneNumber} />
          <p id="phone-hint" className={errors.phoneNumber ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
            {errors.phoneNumber ? t("auth.errors.phone") : t("auth.phoneHint")}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="avatar">{t("auth.avatar")}</Label>
          <Input id="avatar" type="file" accept="image/*" {...form.register("avatar")} />
        </div>
        {error && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
          {t("auth.submitRegister")}
        </Button>
      </form>
    </AuthLayout>
  );
};
