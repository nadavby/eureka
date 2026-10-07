import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { ItemType } from "@/lib/types";
import { tagNumber } from "@/lib/format";

interface ClaimTagProps {
  id: string;
  itemType: ItemType;
  imageUrl: string;
  title: string;
  meta?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Rendered in the tag head, after the stamp (e.g. a status chip). */
  headExtra?: ReactNode;
}

/**
 * An item shown as a lost-property claim tag: a manila head with a punched hole,
 * a mono tag number and a LOST / FOUND stamp, above the photo and details.
 */
export const ClaimTag = ({ id, itemType, imageUrl, title, meta, footer, className, headExtra }: ClaimTagProps) => {
  const { t } = useTranslation();
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="relative flex items-center gap-2 bg-manila px-3 pb-2 pt-6 text-manila-foreground [clip-path:polygon(14px_0,calc(100%-14px)_0,100%_14px,100%_100%,0_100%,0_14px)]">
        {/* punched hole */}
        <span
          aria-hidden
          className="absolute left-1/2 top-2 size-3 -translate-x-1/2 rounded-full bg-background ring-2 ring-manila-edge"
        />
        <span dir="ltr" className="font-mono text-xs font-medium tracking-wider [unicode-bidi:isolate]" aria-label={t("tag.number", { number: tagNumber(id) })}>
          {tagNumber(id)}
        </span>
        <span
          className={cn(
            "ms-auto -rotate-6 rounded-[3px] border-2 px-1.5 py-px font-mono text-[11px] font-medium uppercase tracking-widest",
            itemType === "lost" ? "border-lost text-lost" : "border-found text-found",
            "bg-card/70"
          )}
        >
          {t(`tag.${itemType}`)}
        </span>
        {headExtra}
      </div>

      <div className="aspect-[4/3] overflow-hidden bg-muted">
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-1 font-sans text-sm font-semibold tracking-normal">{title}</h3>
        {meta && <div className="text-xs text-muted-foreground">{meta}</div>}
        {footer && <div className="mt-auto pt-2">{footer}</div>}
      </div>
    </article>
  );
};
