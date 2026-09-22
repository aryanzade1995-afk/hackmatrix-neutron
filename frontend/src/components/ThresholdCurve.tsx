"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatStrip } from "@/components/StatStrip";
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

  // Both series carry a retention percentage so the two axes can be read
  // against each other: at every k, what fraction of groups and of cases
  // survives. This is the actual shape of the trade.
  const plot = points.map((point) => ({
    ...point,
    groupsPct: k1 && k1.groups > 0 ? (point.groups / k1.groups) * 100 : 0,
    casesPct:
      k1 && k1.casesRetained > 0 ? (point.casesRetained / k1.casesRetained) * 100 : 0,
  }));

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
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart
              data={plot}
              margin={{ top: 16, right: 20, bottom: 4, left: -8 }}
            >
              <defs>
                <linearGradient id="casesKept" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[2]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={SERIES[2]} stopOpacity={0.02} />
                </linearGradient>
              </defs>

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
              {/* Both series are percentages of their k=1 value, so one axis
                  serves both and the curves are directly comparable. */}
              <YAxis
                domain={[0, 105]}
                ticks={[0, 25, 50, 75, 100]}
                tickFormatter={(v) => `${v}%`}
                tick={{ fill: CHART.axis, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={46}
              />
              <Tooltip
                labelFormatter={(v) => `Threshold k = ${v}`}
                formatter={(value, name, item) => {
                  const row = item?.payload as (typeof plot)[number] | undefined;
                  if (name === "casesPct")
                    return [
                      `${Number(value).toFixed(1)}%  (${row?.casesRetained.toLocaleString()} cases)`,
                      "cases retained",
                    ];
                  return [
                    `${Number(value).toFixed(1)}%  (${row?.groups} groups)`,
                    "groups visible",
                  ];
                }}
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
              <Legend
                verticalAlign="bottom"
                height={26}
                iconType="plainline"
                iconSize={18}
                wrapperStyle={{ fontSize: 11.5, color: CHART.inkMuted }}
                formatter={(name) =>
                  name === "casesPct" ? "cases retained" : "groups visible"
                }
              />

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

              {/* Cases barely move; groups fall away sharply. The gap between
                  the two curves is what the threshold actually buys. */}
              <Area
                type="stepAfter"
                dataKey="casesPct"
                stroke={SERIES[2]}
                strokeWidth={2}
                fill="url(#casesKept)"
                isAnimationActive={false}
              />
              <Line
                type="stepAfter"
                dataKey="groupsPct"
                stroke={SERIES[0]}
                strokeWidth={2.25}
                dot={{ r: 3, fill: SERIES[0], strokeWidth: 0 }}
                isAnimationActive={false}
              />
              {chosen && k1 && k1.groups > 0 && (
                <ReferenceDot
                  x={chosen.k}
                  y={(chosen.groups / k1.groups) * 100}
                  r={5}
                  fill={CHART.warning}
                  stroke={CHART.surface}
                  strokeWidth={2}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {curve.source === "api" && curve.data && chosen && k1 && (
        <StatStrip
          stats={[
            {
              label: "Groups at k=1",
              value: String(k1.groups),
              note: "no threshold at all",
            },
            {
              label: `Groups at k=${curve.data.productionK}`,
              value: String(chosen.groups),
              note: `${((chosen.groups / k1.groups) * 100).toFixed(0)}% retained`,
            },
            {
              label: "Cases retained",
              value: `${casesKept?.toFixed(1)}%`,
              note: `${chosen.casesRetained.toLocaleString()} of ${k1.casesRetained.toLocaleString()}`,
            },
            {
              label: "Cost per group hidden",
              value:
                groupsLost && groupsLost > 0
                  ? ((k1.casesRetained - chosen.casesRetained) / groupsLost).toFixed(1)
                  : "—",
              note: "cases, on average",
            },
          ]}
        />
      )}

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
