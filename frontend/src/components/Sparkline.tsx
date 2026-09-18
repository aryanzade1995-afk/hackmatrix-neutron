import type { VitalPoint } from "@/lib/clinical";

/**
 * A vital read as a direction, not a snapshot. 138/86 means little alone;
 * 138/86 down from 178/104 is the whole story.
 */
export function Sparkline({
  series,
  width = 108,
  height = 30,
  tone = "forest",
}: {
  series: VitalPoint[];
  width?: number;
  height?: number;
  tone?: "forest" | "sage";
}) {
  if (series.length < 2) return null;

  const values = series.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const step = width / (series.length - 1);

  const coords = series.map((p, i) => {
    const x = i * step;
    const y = pad + (1 - (p.value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });

  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = coords[coords.length - 1];

  const stroke = tone === "forest" ? "var(--color-forest-mid)" : "var(--color-sage)";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-[30px] w-full overflow-visible"
      role="img"
      aria-label={`Trend across ${series.length} visits`}
    >
      <defs>
        <linearGradient id={`spark-${tone}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${tone})`} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r="2.75" fill={stroke} />
    </svg>
  );
}
