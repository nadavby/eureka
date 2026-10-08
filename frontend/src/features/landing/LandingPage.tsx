import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Camera, Handshake, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClaimTag } from "@/components/claim-tag/ClaimTag";
import { TiedTags } from "@/components/claim-tag/TiedTags";
import { useSession } from "@/features/auth/session";
import { ParticleWordmark } from "./ParticleWordmark";
import { TryDemoButton } from "@/features/demo/TryDemoButton";
import { ServerStatus } from "@/components/ServerStatus";
import walletLost from "./example-lost.svg";
import walletFound from "./example-found.svg";

const STEPS = [
  { icon: Camera, title: "landing.step1Title", body: "landing.step1Body" },
  { icon: ScanSearch, title: "landing.step2Title", body: "landing.step2Body" },
  { icon: Handshake, title: "landing.step3Title", body: "landing.step3Body" },
] as const;

export const LandingPage = () => {
  const { t } = useTranslation();
  const { userId } = useSession();
  // Only visitors who arrive already signed in are sent on; signing in here (e.g. the demo) navigates itself.
  const [arrivedSignedIn] = useState(() => !!userId);
  if (arrivedSignedIn) return <Navigate to="/items" replace />;

  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-6 sm:pb-20">
          <div className="h-[34vw] max-h-[340px] min-h-[150px] w-full">
            <ParticleWordmark />
          </div>
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-balance text-3xl font-bold sm:text-5xl">{t("landing.headline")}</h1>
            <p className="mt-4 text-pretty text-base text-muted-foreground sm:text-lg">{t("landing.lead")}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to="/report/lost">{t("nav.reportLost")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
                <Link to="/report/found">{t("nav.reportFound")}</Link>
              </Button>
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              <TryDemoButton variant="ghost" size="default" className="text-primary" />
              <p className="max-w-sm text-xs text-muted-foreground">{t("demo.hint")}</p>
              <ServerStatus />
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              {t("landing.haveAccount")}{" "}
              <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                {t("nav.signIn")}
              </Link>
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <h2 className="text-2xl font-bold">{t("landing.howTitle")}</h2>
          <ol className="mt-8 space-y-7">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full border bg-card font-mono text-sm">
                  {i + 1}
                </span>
                <div>
                  <h3 className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
                    <Icon className="size-4 text-primary" aria-hidden /> {t(title)}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t(body)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <figure className="rounded-xl border bg-card/50 p-5 pt-16 sm:p-8 sm:pt-20">
          <TiedTags
            score={92}
            left={
              <ClaimTag
                id="64f1c2a9e3b7d1a41f2c"
                itemType="lost"
                imageUrl={walletLost}
                title={t("landing.exampleCategory")}
                meta={t("landing.exampleLostWhere")}
              />
            }
            right={
              <ClaimTag
                id="64f1c3b0aa9e4d07c5e8"
                itemType="found"
                imageUrl={walletFound}
                title={t("landing.exampleCategory")}
                meta={t("landing.exampleFoundWhere")}
              />
            }
          />
          <figcaption className="mt-6 space-y-2">
            <p className="text-sm font-semibold">{t("landing.exampleTitle")}</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {(["landing.exampleReason1", "landing.exampleReason2"] as const).map((k) => (
                <li key={k} className="flex gap-2">
                  <span aria-hidden className="text-found">
                    ✓
                  </span>
                  {t(k)}
                </li>
              ))}
            </ul>
          </figcaption>
        </figure>
      </section>
    </>
  );
};
