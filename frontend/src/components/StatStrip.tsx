"use client";

import { Minus, TrendingDown, TrendingUp } from "lucide-react";

/**
 * The summary statistics under a chart.
 *
 * A chart shows shape; these show magnitude and spread, which is what someone
 * actually quotes in a meeting. Kept to five figures — a strip of twelve is a
 * table wearing a costume.
 */

export type Stat = {
  label: string;
  value: string;
  /** Optional second line: units, a definition, a caveat. */
  note?: string;
};

export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-4 border-t border-border px-7 py-4">
      {stats.map((stat) => (
        <div key={stat.label} className="min-w-[72px]">
          <p className="text-[10.5px] uppercase tracking-[0.07em] text-ink-faint">
            {stat.label}
          </p>
          <p className="nums mt-1 text-[16px] font-semibold text-ink">{stat.value}</p>
          {stat.note && (
            <p className="mt-0.5 text-[11px] text-ink-faint">{stat.note}</p>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * A period-over-period change, coloured only by direction.
 *
 * Deliberately not red-for-up: more dengue cases is bad, more follow-ups
 * attended is good, and this component cannot tell which it is looking at.
 * The arrow carries the direction; the colour stays neutral so the interface
 * does not editorialise a number it does not understand.
 */
export function ChangeChip({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[13px] text-ink-faint">—</span>;

  const rounded = Math.round(pct);
  const Icon = rounded > 2 ? TrendingUp : rounded < -2 ? TrendingDown : Minus;

  return (
    <span className="inline-flex items-center gap-1.5 text-ink">
      <Icon className="h-3.5 w-3.5 text-ink-muted" />
      <span className="nums text-[16px] font-semibold">
        {rounded > 0 ? "+" : ""}
        {rounded}%
      </span>
    </span>
  );
}
