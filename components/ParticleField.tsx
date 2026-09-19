"use client";

import { useEffect, useRef } from "react";

interface ParticleFieldProps {
  colors: string[]; // "r,g,b" strings
  count: number;
}

type ShapeKind = "dot" | "blob" | "streak" | "ring";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ParticleField({ colors, count }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seedRef = useRef<number>(Math.floor(Math.random() * 1e9));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let visible = document.visibilityState === "visible";
    const onVisibility = () => {
      visible = document.visibilityState === "visible";
      if (visible) draw();
    };
    document.addEventListener("visibilitychange", onVisibility);

    function draw() {
      if (!visible || !canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const rand = mulberry32(seedRef.current);

      // Mostly crisp small dots (starfield look), with a light sprinkle of
      // tiny rings/streaks and only a rare, small, subtle glow blob.
      for (let i = 0; i < count; i++) {
        const roll = rand();
        let kind: ShapeKind = "dot";
        if (roll > 0.99) kind = "blob";
        else if (roll > 0.975) kind = "streak";
        else if (roll > 0.94) kind = "ring";

        const color = colors[Math.floor(rand() * colors.length)];
        const x = rand() * w;
        const y = rand() * h;
        const alpha = rand() * 0.5 + 0.25;

        ctx.save();
        if (kind === "dot") {
          const size = rand() * 1.4 + 0.4;
          const glow = rand() > 0.85 ? rand() * 5 + 2 : 0;
          if (glow > 0) {
            ctx.shadowColor = `rgba(${color},0.9)`;
            ctx.shadowBlur = glow;
          }
          ctx.fillStyle = `rgba(${color},${alpha})`;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === "blob") {
          const size = rand() * 14 + 8;
          const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
          grad.addColorStop(0, `rgba(${color},${alpha * 0.3})`);
          grad.addColorStop(1, `rgba(${color},0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.fill();
        } else if (kind === "streak") {
          const len = rand() * 20 + 8;
          const angle = rand() * Math.PI * 2;
          ctx.strokeStyle = `rgba(${color},${alpha})`;
          ctx.lineWidth = rand() * 1.2 + 0.4;
          ctx.shadowColor = `rgba(${color},0.7)`;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
          ctx.stroke();
        } else if (kind === "ring") {
          const size = rand() * 8 + 3;
          ctx.strokeStyle = `rgba(${color},${alpha})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(x, y, size, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    draw();

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(draw, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimeout(resizeTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colors, count]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0"
    />
  );
}
