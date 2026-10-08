import { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/*
 * Geometry: two equal columns with a 2rem gap. Each tag's hole is centred in its column,
 * 14px below the tag's top edge (see ClaimTag), so the holes sit at
 * x = 25% - 0.5rem and x = 75% + 0.5rem. The string spans exactly that range.
 */
const HOLE_Y = 14;
const STRING_HEIGHT = 56;

/**
 * Two claim tags tied together by a string through their punched holes,
 * with the match score at the knot. The signature of a match.
 */
export const TiedTags = ({ left, right, score }: { left: ReactNode; right: ReactNode; score: number }) => {
  const { t } = useTranslation();
  return (
    <div className="relative">
      <svg
        aria-hidden
        viewBox={`0 0 200 ${STRING_HEIGHT}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute z-10 overflow-visible"
        style={{
          left: "calc(25% - 0.5rem)",
          // an absolutely positioned <svg> ignores "right" (replaced element), so the width is explicit
          width: "calc(50% + 1rem)",
          top: HOLE_Y - STRING_HEIGHT,
          height: STRING_HEIGHT,
        }}
      >
        <path
          d={`M0 ${STRING_HEIGHT} C 40 0, 160 0, 200 ${STRING_HEIGHT}`}
          fill="none"
          stroke="var(--manila-edge)"
          strokeWidth="2.2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
          pathLength={1}
          className="[stroke-dasharray:1] [stroke-dashoffset:1] motion-safe:animate-[draw-string_900ms_ease-out_150ms_forwards] motion-reduce:[stroke-dashoffset:0]"
        />
      </svg>
      <div
        className="absolute left-1/2 z-20 grid size-14 -translate-x-1/2 place-items-center rounded-full border-2 border-manila-edge bg-manila text-manila-foreground shadow-sm"
        style={{ top: HOLE_Y - STRING_HEIGHT * 0.75 - 28 }}
        aria-label={t("tag.score", { score })}
      >
        <span className="font-mono text-base font-medium leading-none">
          {score}
          <span className="text-[10px]">%</span>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-8">
        {left}
        {right}
      </div>
    </div>
  );
};
