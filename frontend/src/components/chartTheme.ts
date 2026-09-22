/**
 * Chart styling, kept in one place so Recharts uses the project's existing
 * tokens rather than its own defaults.
 *
 * Recharts needs literal colour values — it cannot resolve Tailwind classes or
 * CSS custom properties through its SVG props — so the hexes below are copied
 * from globals.css. They are the same greens, not a second palette.
 */

/** Series colours, ordered so the busiest line is darkest. */
export const SERIES = [
  "#1B3B2D", // forest
  "#2F5A45", // forest-mid
  "#6E9678", // sage
  "#8A5B08", // warning — visually separate from the greens
  "#A8C2AC", // sage-light — last, it is the faintest on white
] as const;

export const CHART = {
  grid: "#D8E2D2", // border
  axis: "#85918A", // ink-faint
  ink: "#14211A", // ink
  inkMuted: "#4E5F56", // ink-muted
  surface: "#FFFFFF", // surface
  canvas: "#EDF2E8", // canvas
  danger: "#A32B20",
  warning: "#8A5B08",
} as const;

/**
 * Sequential ramp for the heatmap, light to dark.
 *
 * Single hue on purpose: a rainbow scale implies categories, but this axis is
 * one quantity getting larger. Suppressed cells are deliberately *not* on this
 * ramp — they use a neutral grey, so "hidden" never reads as "a small number".
 */
const RAMP = [
  "#F2F6F0",
  "#E2EBDC",
  "#CFE0C9",
  "#A8C2AC",
  "#6E9678",
  "#2F5A45",
  "#1B3B2D",
] as const;

/** Text needs to flip to cream once the background is dark enough to need it. */
const RAMP_TEXT_FLIPS_AT = 4;

export type HeatCell = { background: string; color: string };

export function heatColor(value: number, max: number): HeatCell {
  if (max <= 0) return { background: RAMP[0], color: "#14211A" };
  // Square root rather than linear: case counts are heavily skewed, and a
  // linear ramp leaves every cell but the largest looking empty.
  const ratio = Math.sqrt(Math.max(value, 0) / max);
  const index = Math.min(RAMP.length - 1, Math.round(ratio * (RAMP.length - 1)));
  return {
    background: RAMP[index],
    color: index >= RAMP_TEXT_FLIPS_AT ? "#F4F1E8" : "#14211A",
  };
}

export const HEAT_LEGEND = RAMP;

/** Week label for an axis: "14 Sep". */
export function weekLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
