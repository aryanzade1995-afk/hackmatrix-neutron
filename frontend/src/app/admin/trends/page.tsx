"use client";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle, SectionLabel } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { FigRecords } from "@/components/Figures";
import { adminTabs } from "@/lib/demo-data";
import { distinctFrom, useSignals, useTrends, type AggregateRow } from "@/lib/adminData";
import { Activity, EyeOff, Loader2, TrendingUp, TriangleAlert } from "lucide-react";

/** Pivots the flat aggregate rows into a district × diagnosis grid. */
function pivot(rows: AggregateRow[]) {
  const { districts, diagnoses } = distinctFrom(rows);
  const lookup = new Map(rows.map((r) => [`${r.district}|${r.diagnosis}`, r.caseCount]));
  return { districts, diagnoses, lookup };
}

export default function AdminTrendsPage() {
  const trends = useTrends();
  const signals = useSignals();
  const { districts, diagnoses, lookup } = pivot(trends.data);

  return (
    <AppShell role="admin" userName="K. Iyer" tabs={adminTabs}>
      <PageTitle
        eyebrow="Pune Division"
        title="Trends by district"
        subtitle="Case counts only. Individual records are not reachable from this view."
        action={
          trends.source === "api" ? (
            <Badge tone="success">Live from the database</Badge>
          ) : trends.source === "loading" ? (
            <Badge tone="neutral">Loading…</Badge>
          ) : (
            <Badge tone="warning">Backend unavailable</Badge>
          )
        }
      />

      {/* ---------------------------------------------------------- Signals */}
      <Card className="mb-6" accent>
        <CardHeader
          eyebrow={
            <Badge tone="sage">
              <Activity className="h-3 w-3" />
              Outbreak signals
            </Badge>
          }
          title="Unusual activity"
          subtitle="A condition whose latest week sits well above its own trailing average. Arithmetic over the suppressed aggregates — no model, and no access to anything an administrator could not already see."
        />

        <div className="px-7 pb-7">
          {signals.source === "loading" && (
            <p className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking for unusual activity…
            </p>
          )}

          {signals.source === "unavailable" && (
            <p className="text-[13px] text-warning">
              Signal detection needs the backend connected. {signals.error}
            </p>
          )}

          {signals.source === "api" && signals.data.length === 0 && (
            <p className="flex items-center gap-2 text-[13.5px] text-ink-muted">
              <TrendingUp className="h-4 w-4 text-sage" />
              No unusual activity in the current data.
            </p>
          )}

          {signals.source === "api" && signals.data.length > 0 && (
            <ul className="space-y-2.5">
              {signals.data.map((s) => (
                <li
                  key={`${s.district}-${s.diagnosis}-${s.week}`}
                  className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl px-4 py-3.5 ${
                    s.severity === "alert" ? "bg-danger-tint" : "bg-warning-tint"
                  }`}
                >
                  <TriangleAlert
                    className={`h-4 w-4 shrink-0 ${
                      s.severity === "alert" ? "text-danger" : "text-warning"
                    }`}
                  />
                  <span className="text-[14px] font-semibold text-ink">
                    {s.diagnosis} in {s.district}
                  </span>
                  <span className="nums text-[13px] text-ink-muted">
                    {s.ratio}× its recent average — {s.currentCount} this week vs ~
                    {s.baselineAvg}
                  </span>
                  <Badge
                    tone={s.severity === "alert" ? "danger" : "warning"}
                    className="ml-auto"
                  >
                    {s.severity}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* ------------------------------------------------------------ Table */}
      <Card className="overflow-hidden">
        <CardHeader
          title="Cases by district and condition"
          subtitle="Groups below the privacy threshold are removed inside the database view, so they never reach this table"
        />

        {trends.source === "loading" && (
          <p className="flex items-center gap-2 px-7 pb-7 text-[13px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading aggregates…
          </p>
        )}

        {trends.source === "unavailable" && (
          <EmptyState
            art={<FigRecords className="h-full w-auto" />}
            title="Trend data needs the backend connected"
            body={
              trends.error ??
              "The aggregate API is unreachable. Nothing is shown rather than falling back to stale numbers."
            }
          />
        )}

        {trends.source === "api" && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-2.5 text-xs font-medium text-ink-muted">
                    District
                  </th>
                  {diagnoses.map((d) => (
                    <th
                      key={d}
                      className="px-5 py-2.5 text-right text-xs font-medium text-ink-muted"
                    >
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {districts.map((district) => (
                  <tr key={district}>
                    <td className="px-5 py-3 text-ink">{district}</td>
                    {diagnoses.map((d) => {
                      const value = lookup.get(`${district}|${d}`);
                      return (
                        <td key={d} className="nums px-5 py-3 text-right">
                          {value === undefined ? (
                            // Absent from the view means it never cleared the
                            // threshold — there is no number here to hide.
                            <span className="inline-flex items-center gap-1 text-xs text-warning">
                              <EyeOff className="h-3 w-3" />
                              hidden
                            </span>
                          ) : (
                            <span className="text-ink-muted">{value}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6">
        <SectionLabel>Why some cells are hidden</SectionLabel>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
          A district and condition combination appears only once at least five
          cases have been recorded for it. The rule lives in the database view,
          not in this page — the administrator&apos;s connection never receives the
          smaller number, so there is nothing here for the interface to leak.
        </p>
      </div>
    </AppShell>
  );
}
