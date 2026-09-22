"use client";

import { Activity, TriangleAlert } from "lucide-react";
import type { TrendSignal } from "@/lib/adminData";

/**
 * A district's worst outstanding signal, at a glance.
 *
 * A summary layer over the heatmap, not a replacement for it: the tiles say
 * which district to look at, the table below says what is happening there.
 *
 * "Quiet" means no signal cleared the detector — not that nothing is
 * happening, and not that a district is problem-free. Below-threshold groups
 * are invisible to the detector too, for the same reason they are invisible to
 * the table, so the tile says "no signal" rather than "all clear".
 */

type Pulse = "quiet" | "watch" | "alert";

const RANK: Record<Pulse, number> = { quiet: 0, watch: 1, alert: 2 };

const STYLE: Record<
  Pulse,
  { ring: string; dot: string; glow: string; text: string; label: string }
> = {
  quiet: {
    ring: "ring-border",
    dot: "bg-sage",
    glow: "",
    text: "text-ink-muted",
    label: "No signal",
  },
  watch: {
    ring: "ring-[rgba(138,91,8,0.45)]",
    dot: "bg-warning",
    glow: "shadow-[0_0_0_4px_rgba(138,91,8,0.08)]",
    text: "text-warning",
    label: "Watch",
  },
  alert: {
    ring: "ring-[rgba(163,43,32,0.50)]",
    dot: "bg-danger",
    glow: "shadow-[0_0_0_4px_rgba(163,43,32,0.10)]",
    text: "text-danger",
    label: "Alert",
  },
};

export function DistrictPulse({
  districts,
  signals,
}: {
  districts: string[];
  signals: TrendSignal[];
}) {
  if (districts.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {districts.map((district) => {
          const mine = signals.filter((s) => s.district === district);
          const pulse = mine.reduce<Pulse>(
            (worst, s) => (RANK[s.severity] > RANK[worst] ? s.severity : worst),
            "quiet",
          );
          const style = STYLE[pulse];
          // The condition driving the worst signal — a district name alone
          // sends the reader hunting through the table for the reason.
          const driver = mine.sort((a, b) => b.ratio - a.ratio)[0];

          return (
            <div
              key={district}
              className={`transition-calm rounded-xl bg-surface px-4 py-3.5 ring-1 ring-inset ${style.ring} ${style.glow}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[13px] font-medium text-ink">
                  {district}
                </span>
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${style.dot} ${
                    pulse === "alert" ? "animate-pulse" : ""
                  }`}
                />
              </div>

              <div className={`mt-2 flex items-center gap-1.5 ${style.text}`}>
                {pulse === "quiet" ? (
                  <Activity className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="text-[12px] font-medium">{style.label}</span>
              </div>

              <p className="mt-1.5 truncate text-[11.5px] text-ink-faint">
                {driver ? (
                  <>
                    {driver.diagnosis} ·{" "}
                    <span className="nums">{driver.ratio}×</span> its average
                  </>
                ) : (
                  "nothing above the detector"
                )}
              </p>
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
        &ldquo;No signal&rdquo; is not &ldquo;all clear&rdquo;. The detector reads
        the same suppressed aggregates as the table below, so a condition with
        fewer than five cases in a week is invisible to it too.
      </p>
    </div>
  );
}
