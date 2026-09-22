"use client";

import { useEffect, useState } from "react";
import { Loader2, Scale } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Card, CardHeader } from "@/components/Card";
import { SERIES } from "@/components/chartTheme";
import { useThresholdCurve } from "@/lib/adminData";

/**
 * The threshold, counted out in marbles.
 *
 * The step chart beside this says the same thing in percentages, which is the
 * precise way to say it. This is the version you can count. Thirty-three solid
 * marbles are the groups this dashboard can see; the frosted ones behind them
 * are the groups that only exist at a lower threshold — present, countable,
 * and deliberately out of reach.
 *
 * One marble is one group, never one person. A group here is a district and a
 * condition, holding anywhere from one case to a few hundred.
 */

/** Marbles land one after another, fast enough not to stall a live demo. */
const STAGGER_MS = 14;

export function MarbleJar() {
  const curve = useThresholdCurve();
  const [dropped, setDropped] = useState(0);

  const points = curve.data?.points ?? [];
  const k1 = points.find((p) => p.k === 1);
  const chosen = points.find((p) => p.k === curve.data?.productionK);

  const visible = chosen?.groups ?? 0;
  const withheld = k1 && chosen ? Math.max(0, k1.groups - chosen.groups) : 0;
  const total = visible + withheld;

  useEffect(() => {
    if (total === 0) return;

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDropped(total);
      return;
    }

    setDropped(0);
    const timers = Array.from({ length: total }, (_, i) =>
      setTimeout(() => setDropped(i + 1), i * STAGGER_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [total]);

  return (
    <Card className="mb-6">
      <CardHeader
        eyebrow={
          <Badge tone="sage">
            <Scale className="h-3 w-3" />
            One marble, one group
          </Badge>
        }
        title="What the threshold holds back"
        subtitle="Solid marbles are the groups this dashboard can read. Frosted ones exist in the data but sit below the threshold."
        action={
          curve.source === "api" ? (
            <Badge tone="neutral">
              {visible} of {total}
            </Badge>
          ) : null
        }
      />

      <div className="px-7 pb-3">
        {curve.source === "loading" && (
          <p className="flex items-center gap-2 py-8 text-[13px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Counting…
          </p>
        )}

        {curve.source === "unavailable" && (
          <p className="py-8 text-[13px] text-warning">
            This needs the backend connected. {curve.error}
          </p>
        )}

        {curve.source === "api" && total > 0 && (
          <div className="flex flex-wrap content-start gap-[7px] rounded-xl bg-canvas px-5 py-5">
            {Array.from({ length: total }, (_, i) => {
              const isVisible = i < visible;
              const landed = i < dropped;
              return (
                <span
                  key={i}
                  className="h-[18px] w-[18px] rounded-full"
                  style={{
                    background: isVisible
                      ? `radial-gradient(circle at 32% 30%, ${SERIES[2]}, ${SERIES[0]} 78%)`
                      : "rgba(110,150,120,0.16)",
                    // Frosted marbles get a ring so they stay countable at a
                    // glance; the point is that you can see how many there are
                    // without being able to see what is in them.
                    boxShadow: isVisible
                      ? "inset 0 -1px 2px rgba(0,0,0,0.25), 0 1px 1px rgba(21,45,33,0.18)"
                      : "inset 0 0 0 1px rgba(110,150,120,0.42)",
                    backdropFilter: isVisible ? undefined : "blur(2px)",
                    opacity: landed ? 1 : 0,
                    transform: landed ? "translateY(0)" : "translateY(-14px)",
                    transition: "opacity 220ms ease-out, transform 260ms ease-out",
                  }}
                  title={
                    isVisible
                      ? "A group above the threshold — its count is readable here"
                      : "A group below the threshold — it exists, but this role cannot read its count"
                  }
                />
              );
            })}
          </div>
        )}
      </div>

      {curve.source === "api" && curve.data && chosen && k1 && (
        <div className="border-t border-border px-7 py-5">
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-[12px]">
            <span className="flex items-center gap-2 text-ink-muted">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  background: `radial-gradient(circle at 32% 30%, ${SERIES[2]}, ${SERIES[0]} 78%)`,
                }}
              />
              <span className="nums font-semibold text-ink">{visible}</span> readable
              at k={curve.data.productionK}
            </span>
            <span className="flex items-center gap-2 text-ink-muted">
              <span
                className="h-3 w-3 rounded-full"
                style={{
                  background: "rgba(110,150,120,0.16)",
                  boxShadow: "inset 0 0 0 1px rgba(110,150,120,0.42)",
                }}
              />
              <span className="nums font-semibold text-ink">{withheld}</span> withheld
              — they would appear only at k=1
            </span>
          </div>

          <p className="max-w-3xl text-[12.5px] leading-relaxed text-ink-muted">
            One marble is one group — a district and a condition — never one
            person. The frosted marbles can be counted but not read, which is the
            whole arrangement: you are allowed to know how much is being withheld
            without being allowed to know what it is.
          </p>
          <p className="mt-2.5 max-w-3xl text-[12px] leading-relaxed text-ink-faint">
            {curve.data.disclosure}
          </p>
        </div>
      )}
    </Card>
  );
}
