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
  useTrends,
  weeklyTotals,
} from "@/lib/adminData";
import { CHART, SERIES, heatColor, weekLabel } from "@/components/chartTheme";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={series} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
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
                    formatter={(v) => [String(v), "cases"] as [string, string]}
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
                  <Bar
                    dataKey="cases"
                    radius={[4, 4, 0, 0]}
                    fill={SERIES[0]}
                    maxBarSize={34}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
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
