"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle, SectionLabel } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { adminTabs } from "@/lib/demo-data";
import {
  AGGREGATE_LIMIT,
  distinctFrom,
  useAggregates,
  useForecast,
  useTrends,
  weeklyTotals,
} from "@/lib/adminData";
import { CHART, SERIES, heatColor, weekLabel } from "@/components/chartTheme";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatStrip, ChangeChip } from "@/components/StatStrip";
import { ReferenceLine as RefLine } from "recharts";
import { movingAverage, summarise } from "@/lib/stats";
import { Info, Loader2, Lock } from "lucide-react";

/**
 * Explore the aggregates.
 *
 * This is deliberately NOT a natural-language assistant. There is no
 * /admin/ask endpoint and no model wired up, so a chat box here would be
 * theatre — and a fake conversation is the one thing guaranteed to embarrass
 * you when a judge types into it.
 *
 * What it does instead is real: pick a district and a condition, and see the
 * weekly series the admin role is actually allowed to read. Every number comes
 * from the suppressed view, and weeks below the threshold are absent rather
 * than zero — which the page says out loud, because "no bar" and "few cases"
 * mean very different things.
 */
export default function AdminAskPage() {
  const trends = useTrends();
  const [district, setDistrict] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<string | null>(null);

  const weekly = useAggregates(district ?? undefined, diagnosis ?? undefined);
  const { districts, diagnoses } = distinctFrom(trends.data);

  const series = useMemo(() => weeklyTotals(weekly.data), [weekly.data]);

  /**
   * The chart plots four things over the same weeks: the counts themselves,
   * a 4-week trailing average, the period mean, and a one-standard-deviation
   * band around that mean. The band is what turns "that bar looks tall" into
   * "that bar is outside normal variation for this series".
   */
  const MA_WINDOW = 4;
  const stats = useMemo(() => summarise(series.map((r) => r.cases)), [series]);

  // Same filters as the chart, so the projection always describes the series
  // on screen rather than some other one.
  const projection = useForecast(district ?? undefined, diagnosis ?? undefined);
  const plot = useMemo(() => {
    const counts = series.map((r) => r.cases);
    const ma = movingAverage(counts, MA_WINDOW);
    return series.map((row, i) => ({
      ...row,
      normal: i === stats.peakIndex ? null : row.cases,
      peak: i === stats.peakIndex ? row.cases : null,
      trend: ma[i],
      // Recharts draws a band as a stacked pair: an invisible floor, then the
      // visible height on top of it. Clamped at zero because a count cannot be
      // negative and a band dipping below the axis implies one could be.
      bandFloor: Math.max(0, stats.mean - stats.sd),
      bandHeight:
        Math.max(0, stats.mean + stats.sd) - Math.max(0, stats.mean - stats.sd),
    }));
  }, [series, stats]);

  /**
   * Observed weeks and projected weeks on one axis.
   *
   * The forecast rows carry no `normal`/`peak` value, so the bars simply stop
   * where the data does and the dashed line carries on — which is the shape
   * the reader should take away: measurement, then estimate.
   */
  type ChartRow = {
    week: string;
    cases: number;
    normal: number | null;
    peak: number | null;
    trend: number | null;
    bandFloor: number | null;
    bandHeight: number | null;
    forecast: number | null;
    bandBase: number | null;
    band: number | null;
  };

  const withForecast = useMemo((): ChartRow[] => {
    const future = (projection.data?.points ?? []).filter((p) => p.forecast !== null);
    const rows: ChartRow[] = plot.map((row) => ({
      ...row,
      forecast: null,
      bandBase: null,
      band: null,
    }));
    if (future.length === 0 || rows.length === 0) return rows;

    // Anchor the projection on the last observed week, at its actual value
    // and with zero width. Without this the dashed line and the interval both
    // begin in mid-air at the following week, and the stacked area draws a
    // wedge down to zero to get there.
    const last = rows[rows.length - 1];
    last.forecast = last.cases;
    last.bandBase = last.cases;
    last.band = 0;

    return [
      ...rows,
      ...future.map((p): ChartRow => ({
        week: p.week,
        cases: 0,
        normal: null,
        peak: null,
        trend: null,
        // null, not 0 — the observed mean+/-SD band describes observed weeks
        // only, and zeroing it draws a collapsing wedge across the boundary.
        bandFloor: null,
        bandHeight: null,
        forecast: p.forecast,
        bandBase: p.lower,
        band: (p.upper ?? 0) - (p.lower ?? 0),
      })),
    ];
  }, [plot, projection.data]);

  const firstForecastWeek =
    projection.data?.points.find((p) => p.forecast !== null)?.week ?? null;

  // A full page of rows means the endpoint may have cut the series short, and
  // saying "877 cases" over a truncated read would be a wrong number on a
  // dashboard whose whole claim is that its numbers are trustworthy.
  const truncated = weekly.data.length >= AGGREGATE_LIMIT;

  const total = series.reduce((sum, r) => sum + r.cases, 0);
  const max = Math.max(1, ...series.map((r) => r.cases));
  const filtered = Boolean(district || diagnosis);

  return (
    <AppShell role="admin" userName="K. Iyer" tabs={adminTabs}>
      <PageTitle
        eyebrow="Aggregate explorer"
        title="Explore the counts"
        subtitle="Filter the weekly aggregates this role is permitted to read. Every number here has already cleared the privacy threshold."
        action={
          <Badge tone="sage">
            <Lock className="h-3 w-3" />
            Aggregate database role
          </Badge>
        }
      />

      <Card className="mb-6">
        <div className="space-y-5 px-7 py-6">
          <div>
            <SectionLabel>District</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip
                label="All districts"
                selected={district === null}
                onClick={() => setDistrict(null)}
              />
              {districts.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  selected={district === d}
                  onClick={() => setDistrict(district === d ? null : d)}
                />
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Condition</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              <Chip
                label="All conditions"
                selected={diagnosis === null}
                onClick={() => setDiagnosis(null)}
              />
              {diagnoses.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  selected={diagnosis === d}
                  onClick={() => setDiagnosis(diagnosis === d ? null : d)}
                />
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={
              filtered
                ? `${diagnosis ?? "All conditions"}${district ? ` · ${district}` : " · division-wide"}`
                : "All conditions, division-wide"
            }
            subtitle={
              truncated
                ? "Weekly counts. Narrow the filters — this read hit the row limit, so the earliest weeks may be incomplete."
                : "Weekly counts, summed across every group that cleared the threshold. Hover a bar for the exact number."
            }
            action={
              <Badge tone="neutral">
                {total.toLocaleString()} cases · {series.length} weeks
              </Badge>
            }
          />
          <div className="px-4 pb-5 pt-1">
            {weekly.source === "loading" && (
              <p className="flex items-center gap-2 px-3 py-12 text-[13px] text-ink-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading…
              </p>
            )}

            {weekly.source === "unavailable" && (
              <p className="px-3 py-12 text-[13px] text-warning">
                This needs the backend connected. {weekly.error}
              </p>
            )}

            {weekly.source === "api" && series.length === 0 && (
              <p className="px-3 py-12 text-[13.5px] leading-relaxed text-ink-muted">
                Nothing to show for this combination — no week reached five cases, so
                every group was suppressed before it reached this role. That is the
                threshold working, not missing data.
              </p>
            )}

            {weekly.source === "api" && series.length > 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart
                  data={withForecast}
                  margin={{ top: 16, right: 16, bottom: 4, left: -8 }}
                >
                  <defs>
                    {/* A vertical fade rather than a flat fill: the bars are
                        the densest ink on the page and a solid block of forest
                        green at this size reads as heavy. */}
                    <linearGradient id="barFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={SERIES[1]} stopOpacity={0.72} />
                    </linearGradient>
                    <linearGradient id="fcBand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.axis} stopOpacity={0.24} />
                      <stop offset="100%" stopColor={CHART.axis} stopOpacity={0.08} />
                    </linearGradient>
                    <linearGradient id="peakFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART.warning} stopOpacity={0.95} />
                      <stop offset="100%" stopColor={CHART.warning} stopOpacity={0.65} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis
                    dataKey="week"
                    tickFormatter={weekLabel}
                    tick={{ fill: CHART.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: CHART.grid }}
                    minTickGap={16}
                  />
                  <YAxis
                    tick={{ fill: CHART.axis, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    labelFormatter={(v) => `Week of ${weekLabel(String(v))}`}
                    formatter={(value, name) => {
                      if (name === "bandFloor" || name === "bandHeight") return [];
                      if (value === null || value === undefined) return [];
                      if (name === "trend")
                        return value === null
                          ? []
                          : [Number(value).toFixed(1), `${MA_WINDOW}-week average`];
                      return [String(value), name === "peak" ? "cases (peak)" : "cases"];
                    }}
                    contentStyle={{
                      background: CHART.surface,
                      border: `1px solid ${CHART.grid}`,
                      borderRadius: 12,
                      fontSize: 12.5,
                      color: CHART.ink,
                      boxShadow: "0 10px 22px -8px rgba(21,45,33,0.18)",
                    }}
                    cursor={{ fill: CHART.canvas }}
                  />

                  {/* Normal range: mean plus or minus one standard deviation. */}
                  <Area
                    dataKey="bandFloor"
                    stackId="band"
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                    activeDot={false}
                  />
                  <Area
                    dataKey="bandHeight"
                    stackId="band"
                    stroke="none"
                    fill={SERIES[2]}
                    fillOpacity={0.14}
                    isAnimationActive={false}
                    activeDot={false}
                  />

                  <ReferenceLine
                    y={stats.mean}
                    stroke={CHART.axis}
                    strokeDasharray="3 4"
                    label={{
                      value: `mean ${stats.mean.toFixed(1)}`,
                      position: "insideTopLeft",
                      fill: CHART.axis,
                      fontSize: 10.5,
                      offset: 8,
                    }}
                  />

                  {/* Two series sharing one x slot. Recharts 3.x renders a
                      <Cell> inside <Bar> as an empty group, so per-bar colour
                      has to come from separate series — the busiest week is
                      marked rather than left for the eye to find by comparing
                      heights. */}
                  <Bar
                    dataKey="normal"
                    stackId="count"
                    fill="url(#barFill)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="peak"
                    stackId="count"
                    fill="url(#peakFill)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={34}
                    isAnimationActive={false}
                  />

                  {/* Projection. Stacked pair: an invisible floor at `lower`,
                      then the visible height up to `upper`. */}
                  <Area
                    dataKey="bandBase"
                    stackId="fc"
                    stroke="none"
                    fill="transparent"
                    isAnimationActive={false}
                    activeDot={false}
                    legendType="none"
                  />
                  <Area
                    dataKey="band"
                    stackId="fc"
                    stroke="none"
                    fill="url(#fcBand)"
                    isAnimationActive={false}
                    activeDot={false}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke={CHART.axis}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={{ r: 3, fill: CHART.axis, strokeWidth: 0 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                  {firstForecastWeek && (
                    <RefLine
                      x={firstForecastWeek}
                      stroke={CHART.grid}
                      label={{
                        value: "projected",
                        position: "insideTopRight",
                        fill: CHART.axis,
                        fontSize: 10.5,
                      }}
                    />
                  )}

                  <Line
                    type="monotone"
                    dataKey="trend"
                    stroke={CHART.ink}
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>

          {weekly.source === "api" && series.length > 0 && (
            <>
              {/* Every overlay gets named. An unexplained band on a chart
                  about privacy is the last thing this page needs. */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-7 pb-4 text-[11px] text-ink-faint">
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-4 rounded-sm"
                    style={{ background: SERIES[0] }}
                  />
                  weekly cases
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-4 rounded-sm"
                    style={{ background: CHART.warning }}
                  />
                  busiest week
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-px w-5 border-t-2 border-dashed border-ink" />
                  {MA_WINDOW}-week trailing average
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-4 rounded-sm"
                    style={{ background: SERIES[2], opacity: 0.3 }}
                  />
                  mean ± 1 SD
                </span>
                {projection.data?.points.some((p) => p.forecast !== null) && (
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-px w-5 border-t-2 border-dashed"
                      style={{ borderColor: CHART.axis }}
                    />
                    projection with interval
                  </span>
                )}
              </div>

              <StatStrip
                stats={[
                  {
                    label: "Total",
                    value: stats.total.toLocaleString(),
                    note: `over ${series.length} weeks`,
                  },
                  {
                    label: "Weekly mean",
                    value: stats.mean.toFixed(1),
                    note: `median ${stats.median.toFixed(1)}`,
                  },
                  {
                    label: "Std deviation",
                    value: stats.sd.toFixed(1),
                    note: stats.mean > 0
                      ? `${((stats.sd / stats.mean) * 100).toFixed(0)}% of mean`
                      : undefined,
                  },
                  {
                    label: "Peak week",
                    value: String(stats.peak),
                    note:
                      stats.peakIndex >= 0 && series[stats.peakIndex]
                        ? weekLabel(series[stats.peakIndex].week)
                        : undefined,
                  },
                ]}
              />

              <div className="flex flex-wrap items-end gap-x-8 gap-y-3 px-7 pb-6">
                <div>
                  <p className="text-[10.5px] uppercase tracking-[0.07em] text-ink-faint">
                    Change
                  </p>
                  <p className="mt-1">
                    <ChangeChip pct={stats.changePct} />
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    last third vs first third
                  </p>
                </div>
                <p className="max-w-md text-[11.5px] leading-relaxed text-ink-faint">
                  These figures are computed over the weeks that cleared the
                  threshold. Suppressed weeks are absent rather than zero, so the
                  mean sits slightly high — the honest direction, since assuming
                  zero would invent counts nobody measured.
                </p>
              </div>

              {projection.source === "api" && projection.data && (
                <div className="border-t border-border px-7 py-4">
                  <p className="text-[11.5px] leading-relaxed text-ink-faint">
                    <span className="font-semibold text-ink-muted">
                      Projection, not a certainty.
                    </span>{" "}
                    {projection.data.method}. {projection.data.caveat}
                  </p>
                </div>
              )}
            </>
          )}
        </Card>

        <div className="space-y-6">
          <Card tone="forest">
            <div className="px-7 py-6">
              <SectionLabel tone="light">What this cannot do</SectionLabel>
              <p className="text-display mt-4 text-[20px] text-cream">
                There is no way to ask
                <br />
                &ldquo;which patients?&rdquo;
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-cream-muted">
                Not because the question is filtered out, but because this
                connection has no grant on the patient tables. The only thing it
                can read is the suppressed aggregate view — so there is nothing
                for a query to reach, however it is phrased.
              </p>
            </div>
          </Card>

          <Card>
            <div className="px-7 py-6">
              <p className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-ink-muted">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-sage" />
                <span>
                  A missing week means that week was suppressed, not that it had
                  zero cases — the two are indistinguishable from here, which is
                  the point of the threshold.
                  <br />
                  <br />
                  It is also why this total runs below the one on the overview.
                  There, five cases have to accumulate per district and condition;
                  here they have to accumulate <em>within a single week</em>. The
                  finer the slice, the more groups fall under the threshold and
                  drop out.
                </span>
              </p>
            </div>
          </Card>

          {series.length > 0 && (
            <Card>
              <CardHeader title="Busiest weeks" divided />
              <ul className="divide-y divide-border">
                {[...series]
                  .sort((a, b) => b.cases - a.cases)
                  .slice(0, 5)
                  .map((row) => {
                    const heat = heatColor(row.cases, max);
                    return (
                      <li
                        key={row.week}
                        className="flex items-center justify-between gap-3 px-6 py-2.5"
                      >
                        <span className="nums text-[13px] text-ink-muted">
                          {weekLabel(row.week)}
                        </span>
                        <span
                          className="nums rounded-md px-2.5 py-1 text-[12.5px] font-semibold"
                          style={{ background: heat.background, color: heat.color }}
                        >
                          {row.cases}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}
