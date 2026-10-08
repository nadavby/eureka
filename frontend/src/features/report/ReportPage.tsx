import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Camera, Check, ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, COLORS } from "@/lib/catalog";
import { downscaleImage } from "@/lib/images";
import { errorMessage } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ItemType } from "@/lib/types";
import { LocationPicker } from "@/features/map/LocationPicker";
import { placeNameAt } from "@/features/map/leaflet";
import { useCreateItem } from "@/features/items/hooks";

const STEPS = ["photo", "details", "place"] as const;
type Step = (typeof STEPS)[number];

interface Draft {
  photo: Blob | null;
  preview: string | null;
  category: string;
  colors: string[];
  brand: string;
  description: string;
  location: { lat: number; lng: number } | null;
  placeName: string;
  date: string; // yyyy-mm-dd
}

const today = () => new Date().toISOString().slice(0, 10);

const StepIndicator = ({ current }: { current: Step }) => {
  const { t } = useTranslation();
  const index = STEPS.indexOf(current);
  return (
    <ol className="mb-8 flex items-center gap-2" aria-label={t("report.progress")}>
      {STEPS.map((step, i) => (
        <li key={step} className="flex flex-1 items-center gap-2" aria-current={i === index ? "step" : undefined}>
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full border font-mono text-xs",
              i < index && "border-primary bg-primary text-primary-foreground",
              i === index && "border-primary text-primary",
              i > index && "text-muted-foreground"
            )}
          >
            {i < index ? <Check className="size-3.5" /> : i + 1}
          </span>
          <span className={cn("hidden text-sm sm:inline", i === index ? "font-medium" : "text-muted-foreground")}>
            {t(`report.step.${step}`)}
          </span>
          {i < STEPS.length - 1 && <span aria-hidden className="h-px flex-1 bg-border" />}
        </li>
      ))}
    </ol>
  );
};

export const ReportPage = () => {
  const { type } = useParams<{ type: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const create = useCreateItem();
  const fileInput = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("photo");
  const [preparing, setPreparing] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    photo: null,
    preview: null,
    category: "",
    colors: [],
    brand: "",
    description: "",
    location: null,
    placeName: "",
    date: today(),
  });
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  useEffect(() => () => {
    if (draft.preview) URL.revokeObjectURL(draft.preview);
  }, [draft.preview]);

  // Fill the place name when the pin settles; the user can still edit it.
  useEffect(() => {
    if (!draft.location) return;
    const { lat, lng } = draft.location;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const name = await placeNameAt(lat, lng, i18n.resolvedLanguage ?? "en");
      if (!cancelled && name) setDraft((d) => ({ ...d, placeName: name }));
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [draft.location, i18n.resolvedLanguage]);

  if (type !== "lost" && type !== "found") return <Navigate to="/report/lost" replace />;
  const itemType: ItemType = type;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    const photo = await downscaleImage(file);
    setPreparing(false);
    setDraft((d) => ({ ...d, photo, preview: URL.createObjectURL(photo) }));
  };

  const valid: Record<Step, boolean> = {
    photo: !!draft.photo,
    details: !!draft.category,
    place: !!draft.location && !!draft.date,
  };

  const next = () => {
    if (!valid[step]) return setShowErrors(true);
    setShowErrors(false);
    setStep(STEPS[STEPS.indexOf(step) + 1]);
  };
  const back = () => setStep(STEPS[STEPS.indexOf(step) - 1]);

  const submit = async () => {
    if (!valid.place || !draft.photo || !draft.location) return setShowErrors(true);
    try {
      const item = await create.mutateAsync({
        itemType,
        photo: draft.photo,
        category: draft.category,
        colors: draft.colors,
        brand: draft.brand.trim() || undefined,
        description: draft.description.trim() || undefined,
        location: draft.location,
        placeName: draft.placeName.trim() || undefined,
        date: new Date(`${draft.date}T12:00:00`),
      });
      toast.success(t("report.submitted"));
      navigate(`/items/${item._id}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, t("report.submitFailed")));
    }
  };

  const BackIcon = i18n.dir() === "rtl" ? ArrowRight : ArrowLeft;
  const NextIcon = i18n.dir() === "rtl" ? ArrowLeft : ArrowRight;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {t(`report.kicker.${itemType}`)}
      </p>
      <h1 className="mb-6 text-2xl font-bold sm:text-3xl">{t(`report.title.${itemType}`)}</h1>
      <StepIndicator current={step} />

      {step === "photo" && (
        <section aria-labelledby="photo-heading" className="space-y-4">
          <h2 id="photo-heading" className="font-sans text-base font-semibold tracking-normal">
            {t("report.photoTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">{t(`report.photoHint.${itemType}`)}</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="sr-only"
            id="photo"
            onChange={(e) => void pickPhoto(e.target.files?.[0])}
          />
          <label
            htmlFor="photo"
            className={cn(
              "flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border-2 border-dashed bg-card text-center transition-colors hover:border-primary focus-within:ring-2 focus-within:ring-ring",
              showErrors && !valid.photo && "border-destructive"
            )}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void pickPhoto(e.dataTransfer.files?.[0]);
            }}
          >
            {preparing ? (
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            ) : draft.preview ? (
              <img src={draft.preview} alt={t("report.photoPreview")} className="size-full object-cover" />
            ) : (
              <>
                <span className="grid size-14 place-items-center rounded-full bg-secondary">
                  <Camera className="size-6 text-primary" />
                </span>
                <span className="font-medium">{t("report.photoCta")}</span>
                <span className="text-xs text-muted-foreground">{t("report.photoFormats")}</span>
              </>
            )}
          </label>
          {draft.preview && (
            <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
              <ImagePlus /> {t("report.photoReplace")}
            </Button>
          )}
          {showErrors && !valid.photo && <p className="text-sm text-destructive">{t("report.errors.photo")}</p>}
        </section>
      )}

      {step === "details" && (
        <section className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="category">{t("report.category")}</Label>
            <Select value={draft.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger id="category" className="w-full" aria-invalid={showErrors && !valid.details}>
                <SelectValue placeholder={t("report.categoryPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {t(`categories.${c}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {showErrors && !valid.details && <p className="text-sm text-destructive">{t("report.errors.category")}</p>}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("report.colors")}</legend>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(({ value, hex }) => {
                const on = draft.colors.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set("colors", on ? draft.colors.filter((c) => c !== value) : [...draft.colors, value])}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                      on ? "border-primary bg-primary/10 text-foreground" : "hover:bg-secondary"
                    )}
                  >
                    <span aria-hidden className="size-3.5 rounded-full border border-black/15" style={{ background: hex }} />
                    {t(`colors.${value}`)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="brand">{t("report.brand")}</Label>
            <Input id="brand" value={draft.brand} onChange={(e) => set("brand", e.target.value)} maxLength={60} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("report.description")}</Label>
            <Textarea
              id="description"
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={t(`report.descriptionPlaceholder.${itemType}`)}
            />
            <p className="text-xs text-muted-foreground">{t("report.descriptionHint")}</p>
          </div>
        </section>
      )}

      {step === "place" && (
        <section className="space-y-5">
          <div className="space-y-2">
            <p className="text-sm font-medium">{t(`report.where.${itemType}`)}</p>
            <LocationPicker value={draft.location} onChange={(p) => set("location", p)} itemType={itemType} />
            {showErrors && !draft.location && <p className="text-sm text-destructive">{t("report.errors.location")}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="space-y-2">
              <Label htmlFor="placeName">{t("report.placeName")}</Label>
              <Input id="placeName" value={draft.placeName} onChange={(e) => set("placeName", e.target.value)} maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">{t(`report.when.${itemType}`)}</Label>
              <Input id="date" type="date" value={draft.date} max={today()} onChange={(e) => set("date", e.target.value)} />
            </div>
          </div>
        </section>
      )}

      <div className="mt-8 flex items-center justify-between gap-3 border-t pt-6">
        {step === "photo" ? (
          <span />
        ) : (
          <Button type="button" variant="ghost" onClick={back}>
            <BackIcon /> {t("common.back")}
          </Button>
        )}
        {step === "place" ? (
          <Button type="button" onClick={() => void submit()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="animate-spin" />}
            {t("report.submit")}
          </Button>
        ) : (
          <Button type="button" onClick={next}>
            {t("report.next")} <NextIcon />
          </Button>
        )}
      </div>
    </div>
  );
};
