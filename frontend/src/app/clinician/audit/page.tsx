"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { FigRecords } from "@/components/Figures";
import { clinicianTabs } from "@/lib/demo-data";
import { useAccessLog, verifyChain, type VerifyResult } from "@/lib/auditLog";
import {
  CheckCircle2,
  Link2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";

function when(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ClinicianAuditPage() {
  const { entries, source, error } = useAccessLog();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [checking, setChecking] = useState(false);

  async function runVerify() {
    setChecking(true);
    setResult(await verifyChain());
    setChecking(false);
  }

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      <PageTitle
        eyebrow="Tamper-evident record"
        title="Audit log"
        subtitle="Every access attempt is recorded, including the ones that were refused."
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={runVerify}
              disabled={checking || source !== "api"}
              className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Verify chain
            </button>
          </div>
        }
      />

      {/* Verification result — the tamper-evidence claim, made checkable */}
      {result && (
        <div
          className={`mb-6 flex items-start gap-3.5 rounded-2xl px-7 py-5 ${
            result.valid ? "bg-success-tint" : "border border-danger bg-danger-tint"
          }`}
        >
          {result.valid ? (
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-success" />
          ) : (
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
          )}
          <div>
            <p
              className={`text-[14.5px] font-semibold ${
                result.valid ? "text-success" : "text-danger"
              }`}
            >
              {result.valid
                ? `${result.rowsChecked} ${result.rowsChecked === 1 ? "entry" : "entries"} verified — chain intact`
                : `Break detected at entry #${result.brokenAtId}`}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
              {result.valid
                ? "Every hash was recomputed from its stored fields and the entry before it. Nothing has been altered."
                : (result.detail ??
                  "An entry no longer matches its recorded hash. Everything after it is suspect.")}
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader
          title="Access attempts"
          subtitle="Each row stores a hash of itself plus the previous row, so an edit anywhere breaks every hash after it"
          divided
        />

        {source === "loading" && (
          <p className="flex items-center gap-2 px-7 py-6 text-[13px] text-ink-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading the audit trail…
          </p>
        )}

        {source === "unavailable" && (
          <EmptyState
            art={<FigRecords className="h-full w-auto" />}
            title="The audit log needs the backend connected"
            body={error ?? "Nothing is shown rather than displaying a placeholder trail."}
          />
        )}

        {source === "api" && entries.length === 0 && (
          <EmptyState
            art={<FigRecords className="h-full w-auto" />}
            title="No access recorded yet"
            body="Open a patient record and it will appear here."
          />
        )}

        {source === "api" && entries.length > 0 && (
          <ul className="divide-y divide-border">
            {entries.map((e) => {
              const emergency = e.action === "emergency_access";
              const granted = e.outcome === "granted";
              return (
                <li key={e.id} className="flex flex-wrap items-start gap-4 px-7 py-4">
                  {granted ? (
                    emergency ? (
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    )
                  ) : (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                      <span className="text-[14px] font-medium text-ink">{e.actor}</span>
                      <span className="text-[12.5px] text-ink-muted">
                        {emergency ? "emergency access" : "viewed record"}
                        {e.patientId && ` · ${e.patientId}`}
                      </span>
                    </div>
                    {e.reason && (
                      <p className="mt-1 text-[12.5px] italic leading-relaxed text-warning">
                        “{e.reason}”
                      </p>
                    )}
                    <p className="nums mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-ink-faint">
                      <Link2 className="h-3 w-3" />
                      {e.hash.slice(0, 10)}…{e.hash.slice(-4)}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Badge tone={granted ? (emergency ? "warning" : "success") : "danger"}>
                      {emergency ? "Break-glass" : granted ? "Granted" : "Denied"}
                    </Badge>
                    <span className="nums text-[11.5px] text-ink-faint">
                      {when(e.createdAt)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
