import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/states";
import { api, errorMessage } from "@/lib/api";
import { downscaleImage } from "@/lib/images";
import { uploadAvatar } from "@/features/auth/api";
import { meQueryKey, useSession } from "@/features/auth/session";

const schema = z.object({
  userName: z.string().trim().min(2).max(40),
  phoneNumber: z.string().trim().min(6).max(20),
});
type FormValues = z.infer<typeof schema>;

export const ProfilePage = () => {
  const { t } = useTranslation();
  const { user, userId } = useSession();
  const queryClient = useQueryClient();
  const [avatarBusy, setAvatarBusy] = useState(false);
  const form = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (user) form.reset({ userName: user.userName, phoneNumber: user.phoneNumber?.trim() ?? "" });
  }, [user, form]);

  const save = async (patch: Record<string, unknown>) => {
    await api.put(`/auth/${userId}`, patch);
    await queryClient.invalidateQueries({ queryKey: meQueryKey(userId) });
  };

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await save(values);
      toast.success(t("profile.saved"));
    } catch (err) {
      toast.error(errorMessage(err, t("profile.saveFailed")));
    }
  });

  const onAvatar = async (file: File | undefined) => {
    if (!file) return;
    setAvatarBusy(true);
    try {
      await save({ imgURL: await uploadAvatar(await downscaleImage(file, 512)) });
      toast.success(t("profile.saved"));
    } catch (err) {
      toast.error(errorMessage(err, t("profile.saveFailed")));
    } finally {
      setAvatarBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-8">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const publicUrl = `${window.location.origin}/u/${user._id}`;
  const readOnly = user.demoRole !== undefined;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <PageHeader title={t("profile.title")} lead={t("profile.lead")} />
      <div className="grid gap-6 md:grid-cols-[1fr_16rem]">
        <form onSubmit={onSubmit} className="space-y-5 rounded-xl border bg-card p-6" noValidate>
          {readOnly && <p className="rounded-md bg-manila px-3 py-2 text-sm text-manila-foreground">{t("demo.readOnly")}</p>}
          <fieldset disabled={readOnly} className="space-y-5 disabled:opacity-70">
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              {user.imgURL && <AvatarImage src={user.imgURL} alt="" />}
              <AvatarFallback>{user.userName.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
              <Label htmlFor="avatar" className="cursor-pointer text-sm font-medium text-primary">
                {avatarBusy ? <Loader2 className="size-4 animate-spin" /> : t("profile.changePhoto")}
              </Label>
              <input id="avatar" type="file" accept="image/*" className="sr-only" onChange={(e) => void onAvatar(e.target.files?.[0])} />
              <p className="text-xs text-muted-foreground" dir="ltr">
                {user.email}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="userName">{t("auth.userName")}</Label>
            <Input id="userName" {...form.register("userName")} aria-invalid={!!form.formState.errors.userName} />
            {form.formState.errors.userName && <p className="text-xs text-destructive">{t("auth.errors.userName")}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">{t("auth.phone")}</Label>
            <Input id="phoneNumber" type="tel" dir="ltr" {...form.register("phoneNumber")} aria-describedby="phone-hint" />
            <p id="phone-hint" className="text-xs text-muted-foreground">
              {t("auth.phoneHint")}
            </p>
          </div>
          <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
            {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
            {t("common.save")}
          </Button>
          </fieldset>
        </form>

        <aside className="rounded-xl border bg-card p-6 text-center">
          <p className="text-sm font-medium">{t("profile.qrTitle")}</p>
          <div className="mx-auto mt-4 w-fit rounded-lg bg-white p-3">
            <QRCodeSVG value={publicUrl} size={160} level="M" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">{t("profile.qrBody")}</p>
        </aside>
      </div>
    </div>
  );
};
