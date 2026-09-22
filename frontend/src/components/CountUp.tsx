"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts from zero to `value` when the number changes.
 *
 * Eased rather than linear, and driven by requestAnimationFrame rather than a
 * fixed tick, so the figure settles instead of stopping dead. Short on
 * purpose: a stat tile that takes two seconds to become readable is worse than
 * one that just shows the number.
 *
 * Returns the number straight through when the reader has asked for reduced
 * motion, or when there is no number to animate to.
 */
export function useCountUp(
  value: number | null,
  /**
   * Changing this re-runs the animation even when `value` is unchanged.
   * Pass the fetch timestamp: a refresh that returns the same numbers should
   * still visibly do something, or the button reads as broken.
   */
  trigger?: number | null,
  durationMs = 850,
): number {
  const [display, setDisplay] = useState(value ?? 0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    if (value === null) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || value === 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    const from = 0;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic: quick off the mark, gentle into the final value.
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, trigger, durationMs]);

  return display;
}

/**
 * A stat tile's number.
 *
 * Takes `value: null` to mean "no number yet" and renders an em dash, so a
 * tile never animates up to a zero that only means the backend is down.
 */
export function CountUp({
  value,
  trigger,
}: {
  value: number | null;
  trigger?: number | null;
}) {
  const shown = useCountUp(value, trigger);
  if (value === null) return <>—</>;
  return <>{shown.toLocaleString()}</>;
}

/** "updated 12s ago", ticking without re-fetching anything. */
export function useAgeLabel(since: number | null): string | null {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (since === null) return;
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [since]);

  if (since === null) return null;
  const seconds = Math.max(0, Math.round((Date.now() - since) / 1000));
  if (seconds < 60) return `updated ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `updated ${minutes}m ago`;
  return `updated ${Math.floor(minutes / 60)}h ago`;
}
