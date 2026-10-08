import { eurekaPath, viewBox } from "@/features/landing/logo-paths";
import { cn } from "@/lib/utils";

const LETTERS = ["E", "U", "R", "E", "K", "A"] as const;

/** The EUREKA logo as static SVG (the same glyphs the particle hero is built from). Always left-to-right. */
export const Wordmark = ({ className }: { className?: string }) => {
  let x = 0;
  const glyphs = LETTERS.map((letter, i) => {
    const width = Number(viewBox[letter].split(" ")[2]);
    const node = <path key={i} d={eurekaPath[letter]} fillRule="evenodd" transform={`translate(${x} 0)`} />;
    x += width + (i === 3 ? 10 : 15);
    return node;
  });
  return (
    <svg
      viewBox={`0 0 ${x - 15} 41`}
      role="img"
      aria-label="Eureka"
      className={cn("h-5 w-auto fill-primary", className)}
    >
      {glyphs}
    </svg>
  );
};
