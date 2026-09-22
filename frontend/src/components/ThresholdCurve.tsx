"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, Scale } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Card, CardHeader } from "@/components/Card";
import { CHART, SERIES } from "@/components/chartTheme";
import { useThresholdCurve } from "@/lib/adminData";

/**
 * What choosing k=5 cost.
 *
 * A threshold is a trade, and a dashboard that shows only the chosen side of
 * it is asking to be taken on trust. This plots both sides: how many groups
 * survive at each candidate k, against how many cases are still counted.
 *
 * Stepped rather than smooth, because k is an integer — a curve sloping
 * between k=3 and k=5 would imply a k=4 reading that nobody computed.
 */
export function ThresholdCurveCard() {
  const curve = useThresholdCurve();

  const points = curve.data?.points ?? [];
  const k1 = points.find((p) => p.k === 1);
  const chosen = points.find((p) => p.k === curve.data?.productionK);

  // The headline trade, computed rather than asserted, so it cannot drift out
  // of step with the data behind the chart.
  const groupsLost = k1 && chosen ? k1.groups - chosen.groups : null;
  const casesKept =
    k1 && chosen && k1.casesRetained > 0
      ? (chosen.casesRetained / k1.casesRetained) * 100
      : null;

  return (
    <Card className="mb-6">
      <CardHeader
        eyebrow={
          <Badge tone="sage">
            <Scale className="h-3 w-3" />
            Privacy / utility
          </Badge>
        }
        title="What the threshold costs"
        subtitle="Groups that survive at each candidate k. Counts only — no group is named, at any k."
        action={
          curve.source === "api" ? (
            <Badge tone="neutral">k = {curve.data?.productionK} in production</Badge>
          ) : null
        }
      />

      <div className="px-4 pb-2">
        {curve.source === "loading" && (
          <p className="flex items-center gap-2 px-3 py-10 text-[13px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Computing the curve…
          </p>
        )}

        {curve.source === "unavailable" && (
          <p className="px-3 py-10 text-[13px] text-warning">
            The tradeoff curve needs the backend connected. {curve.error}
          </p>
        )}

        {curve.source === "api" && curve.data && (
          <ResponsiveContainer width="100%" height={210}>
            <LineChart
              data={points}
              margin={{ top: 12, right: 20, bottom: 4, left: -12 }}
            >
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="k"
                type="number"
                domain={[1, 10]}
                ticks={points.map((p) => p.k)}
                tickFormatter={(v) => `k=${v}`}
                tick={{ fill: CHART.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: CHART.grid }}
              />
              <YAxis
                tick={{ fill: CHART.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
                label={undefined}
              />
              <Tooltip
                labelFormatter={(v) => `Threshold k = ${v}`}
                formatter={(value, name) => [
                  String(value),
                  name === "groups" ? "groups visible" : "cases retained",
                ]}
                contentStyle={{
                  background: CHART.surface,
                  border: `1px solid ${CHART.grid}`,
                  borderRadius: 12,
                  fontSize: 12.5,
                  color: CHART.ink,
                  boxShadow: "0 10px 22px -8px rgba(21,45,33,0.18)",
                }}
                cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
              />

              {/* The chosen threshold, marked on the chart rather than only
                  described underneath it. */}
              <ReferenceLine
                x={curve.data.productionK}
                stroke={CHART.warning}
                strokeDasharray="4 4"
                label={{
                  value: "in production",
                  position: "top",
                  fill: CHART.warning,
                  fontSize: 11,
                }}
              />
              <Line
                type="stepAfter"
                dataKey="groups"
                stroke={SERIES[0]}
                strokeWidth={2.25}
                dot={{ r: 3, fill: SERIES[0], strokeWidth: 0 }}
                isAnimationActive={false}
              />
              {chosen && (
                <ReferenceDot
                  x={chosen.k}
                  y={chosen.groups}
                  r={5}
                  fill={CHART.warning}
                  stroke={CHART.surface}
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {curve.source === "api" && curve.data && (
        <div className="border-t border-border px-7 py-5">
          <p className="max-w-3xl text-[13px] leading-relaxed text-ink-muted">
            {groupsLost !== null && casesKept !== null && chosen && k1 ? (
              <>
                Moving from k=1 to k={curve.data.productionK} removed{" "}
                <span className="nums font-semibold text-ink">{groupsLost}</span> of{" "}
                <span className="nums">{k1.groups}</span> groups from this dashboard
                — but those groups held so few cases between them that{" "}
                <span className="nums font-semibold text-ink">
                  {casesKept.toFixed(1)}%
                </span>{" "}
                of all recorded cases are still counted. That is the argument for
                this threshold: the suppressed groups are the small ones, and small
                groups are both the least useful to a public-health reader and the
                easiest to re-identify.
              </>
            ) : null}
          </p>
          <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-ink-faint">
            Computed over the custodian connection ({curve.data.computedBy}), not
            this dashboard&apos;s — the aggregate role could not produce this chart,
            because the readings below k={curve.data.productionK} are exactly what
            its views remove. No group is named at any k, and nothing here says
            which groups fall on either side of a line.
          </p>
        </div>
      )}
    </Card>
  );
}
