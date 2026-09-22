"use client";

import { Cloud, CloudLightning, Sun } from "lucide-react";
import type { TrendSignal } from "@/lib/adminData";

/**
 * District conditions, read like a weather strip.
 *
 * A summary layer over the heatmap, not a replacement for it: the tiles say
 * which district to look at, the table below says what is happening there.
 *
 * The weather metaphor is doing real work rather than decorating. A forecast
 * is understood to be a reading of available evidence rather than a promise,
 * which is exactly the epistemic status of these signals — and "calm" is
 * understood to mean "nothing showing on the instruments", not "nothing
 * happening". That is the honest reading here too: below-threshold groups are
 * invisible to the detector just as they are to the table.
 */

type Pulse = "calm" | "watch" | "alert";

const RANK: Record<Pulse, number> = { calm: 0, watch: 1, alert: 2 };

const WEATHER: Record<
  Pulse,
  {
    Icon: typeof Sun;
    word: string;
    ring: string;
    glow: string;
    icon: string;
    word_: string;
  }
> = {
  calm: {
    Icon: Sun,
    word: "calm",
    ring: "ring-border",
    glow: "",
    icon: "text-sage",
    word_: "text-ink-muted",
  },
  watch: {
    Icon: Cloud,
    word: "clouding over",
    // Tailwind opacity modifiers do not resolve against this project's
    // CSS-variable colours, so these are literal rgba.
    ring: "ring-[rgba(138,91,8,0.45)]",
    glow: "shadow-[0_0_0_4px_rgba(138,91,8,0.08)]",
    icon: "text-warning",
    word_: "text-warning",
  },
  alert: {
    Icon: CloudLightning,
    word: "storm",
    ring: "ring-[rgba(163,43,32,0.50)]",
    glow: "shadow-[0_0_0_4px_rgba(163,43,32,0.10)]",
    icon: "text-danger",
    word_: "text-danger",
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
            "calm",
          );
          const { Icon, word, ring, glow, icon, word_ } = WEATHER[pulse];

          // The condition driving the worst signal — a district name and a
          // weather word alone send the reader hunting through the table for
          // the reason.
          const driver = [...mine].sort((a, b) => b.ratio - a.ratio)[0];

          return (
            <div
              key={district}
              className={`transition-calm rounded-xl bg-surface px-4 py-3.5 ring-1 ring-inset ${ring} ${glow}`}
              title={
                driver
                  ? `${district}: ${driver.diagnosis} at ${driver.ratio}× its ${driver.baselineWeeks}-week average`
                  : `${district}: no condition cleared the detector`
              }
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={`mt-0.5 h-6 w-6 shrink-0 ${icon} ${
                    pulse === "alert" ? "animate-pulse" : ""
                  }`}
                  strokeWidth={1.6}
                />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-ink">
                    {district}
                  </p>
                  <p className={`text-[12px] font-medium ${word_}`}>{word}</p>
                  <p className="mt-1 truncate text-[11.5px] text-ink-faint">
                    {driver ? (
                      <>
                        {driver.diagnosis} rising ·{" "}
                        <span className="nums">{driver.ratio}×</span>
                      </>
                    ) : (
                      "nothing above the detector"
                    )}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-faint">
        &ldquo;Calm&rdquo; means nothing showed on the instruments, not that
        nothing is happening. The detector reads the same suppressed aggregates
        as the table below, so a condition with fewer than five cases in a week
        is invisible to it too.
      </p>
    </div>
  );
}
