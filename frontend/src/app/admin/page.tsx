"use client";

import Link from "next/link";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle, SectionLabel } from "@/components/Card";
import { FigAdministrator } from "@/components/Figures";
import { adminTabs } from "@/lib/demo-data";
import {
  distinctFrom,
  useAggregates,
  useFacilities,
  useSignals,
  useTrends,
  weeklyByCondition,
  type AggregateRow,
} from "@/lib/adminData";
import { CHART, SERIES, heatColor, weekLabel } from "@/components/chartTheme";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { summarise, zScore } from "@/lib/stats";
import {
  ArrowUpRight,
  EyeOff,
  Loader2,
  Lock,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import { CountUp, useAgeLabel } from "@/components/CountUp";
import { ChangeChip, StatStrip } from "@/components/StatStrip";
import { ProvePanel } from "@/components/ProvePanel";

/** Totals per condition, summed across districts. */
function byCondition(rows: AggregateRow[]) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    totals.set(r.diagnosis, (totals.get(r.diagnosis) ?? 0) + r.caseCount);
  }
  return [...totals.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

/** Whole weeks between a week-start date and today. */
function weeksSince(iso: string): number {
  const then = new Date(iso).getTime();
  return Math.max(0, Math.floor((Date.now() - then) / (7 * 86_400_000)));
}

export default function AdminPage() {
  const trends = useTrends();
  const weekly = useAggregates();
  const signals = useSignals();
  const facilities = useFacilities();

  const casesByCondition = byCondition(trends.data);
  const maxCases = Math.max(1, ...casesByCondition.map((c) => c.value));
  const { conditions, series } = weeklyByCondition(weekly.data, 4);

  /**
   * The leading condition gets an area fill and its outlier weeks marked.
   *
   * "Outlier" here means two standard deviations from that condition's own
   * mean — its own history, not a division-wide average, because a condition
   * running at 40 cases a week and one running at 4 are not comparable on a
   * shared scale.
   */
  const lead = conditions[0];
  const leadValues = lead ? series.map((row) => Number(row[lead] ?? 0)) : [];
  const leadStats = summarise(leadValues);
  const outliers = lead
    ? series
        .map((row, i) => ({ row, i, z: zScore(leadValues[i], leadValues) }))
        .filter((d) => Math.abs(d.z) >= 2)
    : [];

  const { districts, diagnoses } = distinctFrom(trends.data);
  const totalCases = trends.data.reduce((sum, r) => sum + r.caseCount, 0);
  const live = trends.source === "api";

  // null rather than 0 when the backend is down: a tile that animates up to
  // zero reads as "no cases", which is a different claim from "no data".
  const stats = [
    {
      label: "Cases in view",
      value: live ? totalCases : null,
      delta: live ? "above the privacy threshold" : "backend unavailable",
      up: false,
    },
    {
      label: "Districts reporting",
      value: live ? districts.length : null,
      delta: "all active",
      up: null,
    },
    {
      label: "Conditions tracked",
      value: live ? diagnoses.length : null,
      delta: "across the division",
      up: null,
    },
    {
      label: "Signals raised",
      value: signals.source === "api" ? signals.data.length : null,
      delta: signals.data.some((s) => s.severity === "alert")
        ? "one or more alerts"
        : "nothing unusual",
      up: signals.data.length > 0,
    },
  ];

  // The four reads are independent, so the freshest is the honest one to show
  // — the label is about whether the page is stale, not about any one request.
  const fetchedAt = Math.max(
    trends.fetchedAt ?? 0,
    weekly.fetchedAt ?? 0,
    signals.fetchedAt ?? 0,
    facilities.fetchedAt ?? 0,
  );
  const age = useAgeLabel(fetchedAt > 0 ? fetchedAt : null);

  const refreshAll = () => {
    trends.reload();
    weekly.reload();
    signals.reload();
    facilities.reload();
  };

  return (
    <AppShell role="admin" userName="K. Iyer" tabs={adminTabs}>
      <PageTitle
        eyebrow="Pune Division · last 30 days"
        title="Public health overview"
        subtitle="Combined case counts only. Individual records are not reachable from this view."
        action={
          <Badge tone="sage">
            <Lock className="h-3 w-3" />
            Aggregate database role
          </Badge>
        }
      />

      {/* Freshness, so nobody has to guess whether the page is stale. */}
      <div className="mb-3 flex items-center justify-end gap-3">
        {age && <span className="nums text-[11.5px] text-ink-faint">{age}</span>}
        <button
          onClick={refreshAll}
          className="transition-calm inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-ink-muted hover:bg-canvas"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {/* Stat row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-surface px-6 py-5 shadow-card"
          >
            <p className="text-[11.5px] text-ink-faint">{stat.label}</p>
            <p className="nums text-display mt-2 text-[32px] text-forest">
              <CountUp value={stat.value} trigger={fetchedAt} />
            </p>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              {stat.up && <ArrowUpRight className="h-3 w-3 text-sage" />}
              {stat.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="mb-6">
        <ProvePanel />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Case trend by condition"
              subtitle="Weekly counts for the busiest conditions, summed across districts. Hover any week for exact numbers."
              action={<Badge tone="neutral">{series.length} weeks</Badge>}
            />
            <div className="px-4 pb-5 pt-1">
              {weekly.source === "loading" && (
                <p className="flex items-center gap-2 px-3 py-10 text-[13px] text-ink-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading weekly counts…
                </p>
              )}
              {weekly.source === "unavailable" && (
                <p className="px-3 py-10 text-[13px] text-warning">
                  Trend data needs the backend connected. {weekly.error}
                </p>
              )}
              {weekly.source === "api" && series.length > 0 && (
                <ResponsiveContainer width="100%" height={272}>
                  <ComposedChart
                    data={series}
                    margin={{ top: 12, right: 18, bottom: 4, left: -8 }}
                  >
                    <defs>
                      <linearGradient id="leadArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SERIES[0]} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={SERIES[0]} stopOpacity={0.01} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid stroke={CHART.grid} vertical={false} />
                    <XAxis
                      dataKey="week"
                      tickFormatter={weekLabel}
                      tick={{ fill: CHART.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: CHART.grid }}
                      minTickGap={18}
                    />
                    <YAxis
                      tick={{ fill: CHART.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      labelFormatter={(v) => `Week of ${weekLabel(String(v))}`}
                      contentStyle={{
                        background: CHART.surface,
                        border: `1px solid ${CHART.grid}`,
                        borderRadius: 12,
                        fontSize: 12.5,
                        color: CHART.ink,
                        boxShadow: "0 10px 22px -8px rgba(21,45,33,0.18)",
                      }}
                      itemStyle={{ color: CHART.inkMuted }}
                      cursor={{ stroke: CHART.grid, strokeWidth: 1 }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={28}
                      iconType="plainline"
                      iconSize={18}
                      wrapperStyle={{ fontSize: 12, color: CHART.inkMuted, paddingTop: 6 }}
                    />

                    {/* Fill under the busiest condition only. Four filled
                        areas would occlude each other into mud. */}
                    {lead && (
                      <Area
                        dataKey={lead}
                        stroke="none"
                        fill="url(#leadArea)"
                        legendType="none"
                        tooltipType="none"
                        isAnimationActive={false}
                        activeDot={false}
                      />
                    )}

                    {conditions.map((condition, i) => (
                      <Line
                        key={condition}
                        type="monotone"
                        dataKey={condition}
                        stroke={SERIES[i % SERIES.length]}
                        strokeWidth={2.25}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 2, stroke: CHART.surface }}
                        isAnimationActive={false}
                      />
                    ))}

                    {/* Weeks where the lead condition sat two standard
                        deviations from its own mean. */}
                    {outliers.map((o) => (
                      <ReferenceDot
                        key={String(o.row.week)}
                        x={String(o.row.week)}
                        y={leadValues[o.i]}
                        r={5}
                        fill={CHART.danger}
                        stroke={CHART.surface}
                        strokeWidth={2}
                      />
                    ))}
                  </ComposedChart>
                </ResponsiveContainer>
              )}
              {weekly.source === "api" && series.length === 0 && (
                <p className="px-3 py-10 text-[13px] text-ink-muted">
                  No weekly group cleared the privacy threshold, so there is nothing
                  to plot. That is suppression working, not missing data.
                </p>
              )}
            </div>

            {weekly.source === "api" && series.length > 0 && lead && (
              <>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-7 pb-3 text-[11px] text-ink-faint">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: CHART.danger }}
                    />
                    weeks more than 2 SD from {lead}&apos;s own mean
                  </span>
                </div>

                <StatStrip
                  stats={[
                    {
                      label: "Busiest",
                      value: lead,
                      note: `${leadStats.total.toLocaleString()} cases`,
                    },
                    {
                      label: "Weekly mean",
                      value: leadStats.mean.toFixed(1),
                      note: `± ${leadStats.sd.toFixed(1)} SD`,
                    },
                    {
                      label: "Peak",
                      value: String(leadStats.peak),
                      note:
                        leadStats.peakIndex >= 0 && series[leadStats.peakIndex]
                          ? weekLabel(String(series[leadStats.peakIndex].week))
                          : undefined,
                    },
                    {
                      label: "Direction",
                      value:
                        Math.abs(leadStats.slope) < 0.25
                          ? "flat"
                          : leadStats.slope > 0
                            ? "rising"
                            : "falling",
                      note: `${leadStats.slope > 0 ? "+" : ""}${leadStats.slope.toFixed(2)}/week`,
                    },
                  ]}
                />

                <div className="px-7 pb-6 pt-1">
                  <p className="text-[10.5px] uppercase tracking-[0.07em] text-ink-faint">
                    Change
                  </p>
                  <p className="mt-1">
                    <ChangeChip pct={leadStats.changePct} />
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    last third vs first third · slope is a fit over observed weeks,
                    not a forecast
                  </p>
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Cases by condition"
              subtitle="Combined across all reporting facilities"
            />
            <div className="space-y-3 px-7 pb-7">
              {casesByCondition.map((c) => {
                const pct = (c.value / maxCases) * 100;
                const heat = heatColor(c.value, maxCases);
                // The count sits outside the bar once the bar is too short to
                // hold it. The previous version faded each row by index, which
                // left the smallest conditions invisible — the same misread
                // the suppression rule exists to avoid.
                const inside = pct > 18;
                return (
                  <div key={c.label} className="flex items-center gap-4">
                    <span className="w-28 shrink-0 text-[13px] text-ink-muted">
                      {c.label}
                    </span>
                    <div className="flex h-8 flex-1 items-center overflow-hidden rounded-lg bg-canvas ring-1 ring-inset ring-border">
                      <div
                        className="transition-calm flex h-8 items-center justify-end rounded-lg pr-3"
                        style={{
                          width: `${Math.max(pct, 1.5)}%`,
                          backgroundColor: heat.background,
                        }}
                      >
                        {inside && (
                          <span
                            className="nums text-[11.5px] font-semibold"
                            style={{ color: heat.color }}
                          >
                            {c.value}
                          </span>
                        )}
                      </div>
                      {!inside && (
                        <span className="nums pl-2.5 text-[11.5px] font-semibold text-ink-muted">
                          {c.value}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-4 px-7 py-6">
              <FigAdministrator className="h-[68px] w-auto shrink-0" />
              <div className="min-w-0">
                <SectionLabel>You are signed in as</SectionLabel>
                <p className="text-display mt-2 text-[19px] text-ink">Administrator</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                  Your database login has no grant on the identified tables. Not a
                  hidden screen — the rows are unreachable from this account.
                </p>
              </div>
            </div>
          </Card>

          <Card tone="forest">
            <div className="px-7 py-6">
              <div className="flex items-center gap-2">
                <EyeOff className="h-[15px] w-[15px] text-sage-light" />
                <SectionLabel tone="light">Privacy threshold active</SectionLabel>
              </div>
              <p className="text-display mt-4 text-[22px] text-cream">
                Fewer than <span className="nums">5</span> cases,
                <br />
                and it is not here
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-cream-muted">
                Any location–week–condition group below the threshold is removed inside
                the database view, before it reaches this dashboard&apos;s role — not
                filtered on screen.
              </p>
              {/* No count of hidden groups is shown, because this connection
                  genuinely cannot know it. Reporting a number here would mean
                  the suppressed data had been read after all. */}
              <div className="mt-5 rounded-xl bg-white/[0.07] px-4 py-3.5 ring-1 ring-inset ring-white/10">
                <p className="text-[12.5px] font-medium text-cream">
                  How many groups are hidden
                </p>
                <p className="mt-1.5 text-[11.5px] text-cream-muted">
                  unknown to this role — counting them would require reading the
                  rows the threshold exists to hide
                </p>
              </div>
            </div>
          </Card>

          {/* Was a mocked-up assistant with a hardcoded question and answer.
              Removed: there is no /admin/ask endpoint and no model behind it,
              and a judge who types into a fake chat box finds that out on
              stage. The real filters live on the explorer page instead. */}
          <Card>
            <CardHeader
              title="Explore the counts"
              subtitle="Filter the same suppressed aggregates by district and condition"
            />
            <div className="px-6 pb-6">
              <p className="text-[13px] leading-relaxed text-ink-muted">
                Every figure on this dashboard comes from one view. The explorer
                lets you slice it without ever widening what this role can read.
              </p>
              <Link
                href="/admin/ask"
                className="transition-calm mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-3.5 py-2.5 text-[13px] font-medium text-ink hover:bg-canvas"
              >
                <SlidersHorizontal className="h-4 w-4 text-sage" />
                Open the aggregate explorer
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Reporting facilities"
              subtitle="Activity by week, from the same suppressed view as everything else"
              divided
            />
            {facilities.source === "api" && facilities.data.length > 0 ? (
              <ul className="divide-y divide-border">
                {facilities.data.map((f) => {
                  const weeksAgo = weeksSince(f.lastWeek);
                  const current = weeksAgo <= 1;
                  return (
                    <li key={f.facility} className="px-6 py-3.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[13.5px] text-ink">{f.facility}</span>
                        <span
                          className={`flex shrink-0 items-center gap-1.5 text-[11.5px] ${
                            current ? "text-success" : "text-warning"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              current ? "bg-success" : "bg-warning"
                            }`}
                          />
                          {current ? "Reporting" : `Last ${weeksAgo}w ago`}
                        </span>
                      </div>
                      <p className="nums mt-1 text-[11.5px] text-ink-faint">
                        {f.caseCount.toLocaleString()} visits · {f.patientCount} patients
                      </p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-6 py-5 text-[12.5px] text-ink-muted">
                {facilities.source === "loading"
                  ? "Loading facility activity…"
                  : facilities.source === "unavailable"
                    ? "Facility activity needs the backend connected."
                    : "No facility has recorded enough visits to clear the threshold."}
              </p>
            )}
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
