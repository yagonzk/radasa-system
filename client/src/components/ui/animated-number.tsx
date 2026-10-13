import { useEffect, useRef, useState } from "react";

/** Animates presentation only; business values are never rounded or modified. */
export function AnimatedNumber({
  value,
  format,
  duration = 850,
}: {
  value: number;
  format: (value: number) => string;
  duration?: number;
}) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [displayed, setDisplayed] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const reducedMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || document.visibilityState === "hidden") {
      current.current = safeValue;
      setDisplayed(safeValue);
      return;
    }

    const start = current.current;
    const difference = safeValue - start;
    if (difference === 0) return;
    let frame = 0;
    let startedAt: number | null = null;
    const animate = (now: number) => {
      startedAt ??= now;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = start + difference * eased;
      current.current = next;
      setDisplayed(next);
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [safeValue, duration]);

  return <span className="tabular-nums">{format(displayed)}</span>;
}
