"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, RefreshCw, TriangleAlert, X } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Card, CardHeader } from "@/components/Card";
import { CHART, SERIES } from "@/components/chartTheme";

/**
 * Live separation checks, on one dial.
 *
 * Every check here comes from a single call to GET /admin/prove, which runs
 * real statements over this dashboard's own connection. The dial is a summary
 * of that call and nothing else — it does not average in anything it cannot
 * currently observe, and it does not hold a stale reading: if the endpoint is
 * unreachable the dial says unknown rather than showing the last good number.
 *
 * Deliberately NOT on this dial: the audit-log hash chain. That check is
 * finished and trustworthy, but it is served over the clinician connection,
 * and an admin dashboard reaching into the clinician's audit log to decorate a
 * gauge would undercut the separation the gauge exists to report. It has its
 * own, better visualisation on the clinician side.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type TableResult = { blocked: boolean; detail?: string };
type ProveResponse = {
  patients: TableResult;
  visits: TableResult;
  aggregates: { blocked: boolean; visibleGroups: number };
  connectedAs: string;
};

type Check = { label: string; detail: string; pass: boolean };

const SIZE = 132;
const STROKE = 11;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUM = 2 * Math.PI * RADIUS;

export function TrustDial() {
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "unavailable">("loading");
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const run = useCallback(async (signal?: AbortSignal) => {
    if (!API) {
      setState("unavailable");
      setError("NEXT_PUBLIC_API_URL is not set");
      return;
    }
    setState("loading");
    try {
      const res = await fetch(`${API}/admin/prove`, { signal, cache: "no-store", credentials: "include" });
      if (!res.ok) throw new Error(`/admin/prove → ${res.status}`);
      const body = (await res.json()) as ProveResponse;

      setChecks([
        {
          label: "Patient records unreachable",
          detail: body.patients.blocked
            ? (body.patients.detail ?? "refused by the database")
            : "THE AGGREGATE ROLE READ THIS TABLE",
          pass: body.patients.blocked,
        },
        {
          label: "Visit records unreachable",
          detail: body.visits.blocked
            ? (body.visits.detail ?? "refused by the database")
            : "THE AGGREGATE ROLE READ THIS TABLE",
          pass: body.visits.blocked,
        },
        {
          label: "Suppressed aggregates readable",
          detail: `${body.aggregates.visibleGroups} groups, all above the threshold`,
          pass: !body.aggregates.blocked && body.aggregates.visibleGroups > 0,
        },
      ]);
      setRole(body.connectedAs);
      setState("ok");
      setError(null);
    } catch (err) {
      if (signal?.aborted) return;
      setState("unavailable");
      setChecks(null);
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void run(controller.signal);
    return () => controller.abort();
  }, [run]);

  const passed = checks?.filter((c) => c.pass).length ?? 0;
  const total = checks?.length ?? 0;
  const allPass = total > 0 && passed === total;
  const fraction = total > 0 ? passed / total : 0;

  // A failure is not "two thirds healthy" — a leak of identified records is a
  // different kind of event from a dashboard being slightly degraded, so the
  // dial turns red the moment any check fails rather than shading gradually.
  const arcColour = !allPass ? CHART.danger : SERIES[0];

  return (
    <Card>
      <CardHeader
        title="Separation check"
        subtitle="Run against this dashboard's own connection, just now"
        action={
          state === "ok" ? (
            <Badge tone={allPass ? "success" : "danger"}>
              {allPass ? "holding" : "FAILED"}
            </Badge>
          ) : state === "loading" ? (
            <Badge tone="neutral">checking…</Badge>
          ) : (
            <Badge tone="warning">unknown</Badge>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-6 px-7 pb-6">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} className="-rotate-90">
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke={CHART.grid}
              strokeWidth={STROKE}
            />
            {state === "ok" && (
              <circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={arcColour}
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUM}
                strokeDashoffset={CIRCUM * (1 - fraction)}
                style={{ transition: "stroke-dashoffset 900ms ease-out" }}
              />
            )}
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {state === "loading" && (
              <Loader2 className="h-5 w-5 animate-spin text-ink-faint" />
            )}
            {state === "unavailable" && (
              <>
                <TriangleAlert className="h-5 w-5 text-warning" />
                <span className="mt-1 text-[11px] text-ink-faint">no reading</span>
              </>
            )}
            {state === "ok" && (
              <>
                <span className="nums text-display text-[26px] text-ink">
                  {passed}/{total}
                </span>
                <span className="text-[10.5px] uppercase tracking-[0.06em] text-ink-faint">
                  checks pass
                </span>
              </>
            )}
          </div>
        </div>

        <div className="min-w-[220px] flex-1">
          {state === "unavailable" && (
            <p className="text-[12.5px] leading-relaxed text-warning">
              The backend is unreachable, so there is nothing to report. This
              shows no reading rather than the last good one — a stale green
              dial is worse than an honest blank.
              <br />
              <span className="text-ink-faint">{error}</span>
            </p>
          )}

          {state === "ok" && checks && (
            <ul className="space-y-2">
              {checks.map((check) => (
                <li key={check.label} className="flex items-start gap-2.5">
                  {check.pass ? (
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                  ) : (
                    <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger" />
                  )}
                  <div className="min-w-0">
                    <p
                      className={`text-[12.5px] font-medium ${
                        check.pass ? "text-ink" : "text-danger"
                      }`}
                    >
                      {check.label}
                    </p>
                    <p className="truncate font-mono text-[11px] text-ink-faint">
                      {check.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-7 py-4">
        <p className="max-w-lg text-[11.5px] leading-relaxed text-ink-faint">
          {role ? (
            <>
              Connected as <span className="font-mono">{role}</span>. These are
              live reads, not a status page — the dial reports what the database
              did a moment ago, not what a config file claims.
            </>
          ) : (
            "These are live reads, not a status page."
          )}
        </p>
        <button
          type="button"
          onClick={() => void run()}
          disabled={state === "loading"}
          className="transition-calm inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11.5px] text-ink-muted hover:bg-canvas disabled:opacity-50"
        >
          <RefreshCw className="h-3 w-3" />
          Check again
        </button>
      </div>
    </Card>
  );
}
