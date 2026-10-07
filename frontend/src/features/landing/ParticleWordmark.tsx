import { useEffect, useRef } from "react";
import { eurekaPath, viewBox } from "./logo-paths";

const LETTERS = ["E", "U", "R", "E", "K", "A"] as const;
type Letter = (typeof LETTERS)[number];

interface Particle {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  size: number;
  life: number;
  vx: number;
  vy: number;
}

const letterWidth = (l: Letter) => Number(viewBox[l].split(" ")[2]);
// K sits a little closer to its neighbours, as in the original logo
const gapBefore = (index: number) => (index === 4 ? 10 : 15);
const WORD_WIDTH = LETTERS.reduce((sum, l, i) => sum + letterWidth(l) + (i < LETTERS.length - 1 ? gapBefore(i + 1) : 0), 0);
const WORD_HEIGHT = 41;

const cssColor = (name: string, fallback: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/** Draws the wordmark as solid glyphs into ctx, centred in a w×h box; returns nothing. */
const drawWordmark = (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const scale = Math.min((w * 0.86) / WORD_WIDTH, (h * 0.7) / WORD_HEIGHT);
  let x = (w - WORD_WIDTH * scale) / 2;
  const y = (h - WORD_HEIGHT * scale) / 2;
  LETTERS.forEach((letter, i) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fill(new Path2D(eurekaPath[letter]), "evenodd");
    ctx.restore();
    x += (letterWidth(letter) + gapBefore(i + 1)) * scale;
  });
};

/**
 * The EUREKA wordmark made of particles that scatter away from the pointer and drift back,
 * like loose tags settling into place. Static wordmark when the user prefers reduced motion.
 */
export const ParticleWordmark = ({ className }: { className?: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let mask: Uint8ClampedArray | null = null;
    let particles: Particle[] = [];
    let frame = 0;
    let running = false;
    let visible = true;
    let time = 0;
    const pointer = { x: -9999, y: -9999, active: false };

    const sample = (): Particle | null => {
      if (!mask) return null;
      for (let attempt = 0; attempt < 60; attempt++) {
        const x = Math.floor(Math.random() * width);
        const y = Math.floor(Math.random() * height);
        if (mask[(y * width + x) * 4 + 3] > 128) {
          return {
            x,
            y,
            baseX: x,
            baseY: y,
            size: Math.random() * 1.2 + 0.9,
            life: Math.random() * 150 + 100,
            vx: (Math.random() - 0.5) * 0.3,
            vy: (Math.random() - 0.5) * 0.3,
          };
        }
      }
      return null;
    };

    // scales with the area, with a floor so the letters stay legible on small screens
    const targetCount = () => Math.max(1800, Math.floor(5200 * Math.sqrt((width * height) / (1200 * 420))));

    const setup = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Rasterise the wordmark at CSS-pixel resolution to get the particle mask.
      const off = document.createElement("canvas");
      off.width = width;
      off.height = height;
      const offCtx = off.getContext("2d")!;
      offCtx.fillStyle = "#000";
      drawWordmark(offCtx, width, height);
      mask = offCtx.getImageData(0, 0, width, height).data;

      particles = [];
      const count = targetCount();
      for (let i = 0; i < count; i++) {
        const p = sample();
        if (p) particles.push(p);
      }
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = cssColor("--primary", "#2563eb");
      drawWordmark(ctx, width, height);
    };

    const tick = () => {
      if (!running) return;
      const settled = cssColor("--primary", "#2563eb");
      const scattered = cssColor("--manila", "#ebc76a");
      const reach = width < 640 ? 110 : 170;
      ctx.clearRect(0, 0, width, height);
      time += 0.008;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += Math.sin(time + p.baseX * 0.008) * 0.2 + p.vx;
        p.y += Math.cos(time + p.baseY * 0.008) * 0.2 + p.vy;

        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const distance = Math.hypot(dx, dy);
        if (pointer.active && distance < reach) {
          const force = (reach - distance) / reach;
          const angle = Math.atan2(dy, dx);
          p.x = p.baseX - Math.cos(angle) * force * 45;
          p.y = p.baseY - Math.sin(angle) * force * 45;
          ctx.fillStyle = scattered;
        } else {
          p.x += (p.baseX - p.x) * 0.03;
          p.y += (p.baseY - p.y) * 0.03;
          ctx.fillStyle = settled;
        }
        ctx.fillRect(p.x, p.y, p.size, p.size);

        if (--p.life <= 0) {
          const fresh = sample();
          if (fresh) particles[i] = fresh;
        }
      }
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (running || reducedMotion || !visible || document.hidden) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    setup();
    if (reducedMotion) drawStatic();
    else start();

    const resize = new ResizeObserver(() => {
      setup();
      if (reducedMotion) drawStatic();
    });
    resize.observe(canvas);

    // Pause when scrolled away or the tab is in the background.
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else stop();
    });
    io.observe(canvas);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      pointer.x = e.clientX - rect.left;
      pointer.y = e.clientY - rect.top;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerdown", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerup", (e) => e.pointerType !== "mouse" && onLeave());

    // Theme changes swap the colors; the static version must be redrawn.
    const themeObserver = new MutationObserver(() => reducedMotion && drawStatic());
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      stop();
      resize.disconnect();
      io.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerdown", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="EUREKA"
      className={className}
      style={{ touchAction: "pan-y", width: "100%", height: "100%", display: "block" }}
    />
  );
};
