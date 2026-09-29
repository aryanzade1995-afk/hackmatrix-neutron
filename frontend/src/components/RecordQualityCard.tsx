"use client";

import {
  CheckCircle2,
  Loader2,
  OctagonAlert,
  ScanSearch,
  Sparkles,
  TriangleAlert,
  Info,
  X,
} from "lucide-react";
import { Badge } from "./Badge";
import { Card, CardHeader } from "./Card";
import type { QualityField, QualityIssue, QualityResult, Severity } from "@/lib/recordQualityAI";

/**
 * AI Record Quality — the card on the visit Review step.
 *
 * Shows the record-quality score, a short checklist, and one card per issue
 * with a way to jump to the field. It only reports: entered values are never
 * changed from here.
 */

const STATUS = {
  GOOD: { label: "Good", tone: "success" as const, text: "text-success", bar: "bg-success" },
  REVIEW: { label: "Review suggested", tone: "warning" as const, text: "text-warning", bar: "bg-warning" },
  ATTENTION: { label: "Attention required", tone: "danger" as const, text: "text-danger", bar: "bg-danger" },
};

const SEVERITY: Record<
  Severity,
  { icon: typeof TriangleAlert; tint: string; iconColor: string; label: string }
> = {
  critical: { icon: OctagonAlert, tint: "bg-danger-tint", iconColor: "text-danger", label: "Critical" },
  warning: { icon: TriangleAlert, tint: "bg-warning-tint", iconColor: "text-warning", label: "Verify" },
  info: { icon: Info, tint: "bg-canvas", iconColor: "text-ink-muted", label: "Suggestion" },
};

export function RecordQualityCard({
  result,
  analyzing,
  dismissedCount,
  onReview,
  onDismiss,
  canReview,
}: {
  result: QualityResult;
  analyzing: boolean;
  dismissedCount: number;
  onReview: (field: QualityField) => void;
  onDismiss: (id: string) => void;
  canReview: (field: QualityField) => boolean;
}) {
  const status = STATUS[result.status];
  const needsAttention = result.issues.filter((i) => i.severity !== "info").length;

  return (
    <Card>
      <CardHeader
        eyebrow={
          <Badge tone="sage">
            <Sparkles className="h-3 w-3" />
            AI-assisted record verification
          </Badge>
        }
        title="AI Record Quality"
        subtitle="Checks this visit against the patient's earlier records for likely entry errors. It flags; you decide."
        action={
          analyzing ? (
            <span className="flex items-center gap-1.5 text-[12px] text-ink-muted" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Analyzing record…
            </span>
          ) : null
        }
      />

      <div
        className={`transition-calm grid grid-cols-1 gap-6 px-7 pb-6 sm:grid-cols-[minmax(0,200px)_minmax(0,1fr)] ${
          analyzing ? "opacity-60" : ""
        }`}
      >
        <div>
          <p className="text-[10.5px] font-semibold uppercase tracking-label text-ink-faint">
            Record quality score
          </p>
          <p className="nums mt-2 text-[34px] font-semibold leading-none text-ink">
            {result.score}
            <span className="text-[16px] font-medium text-ink-faint"> / 100</span>
          </p>
          <p className={`mt-2 text-[13px] font-semibold uppercase tracking-label ${status.text}`}>
            {status.label}
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-canvas">
            <div
              className={`transition-calm h-full rounded-full ${status.bar}`}
              style={{ width: `${result.score}%` }}
            />
          </div>
          <p className="mt-2.5 text-[11px] leading-snug text-ink-faint">
            A score for the record, not the patient&apos;s health.
          </p>
        </div>

        <ul className="space-y-2">
          {result.checks.map((c) => (
            <li key={c.label} className="flex items-center gap-2.5 text-[13px]">
              {c.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : c.label === "Allergies" ? (
                <OctagonAlert className="h-4 w-4 shrink-0 text-danger" />
              ) : (
                <TriangleAlert className="h-4 w-4 shrink-0 text-warning" />
              )}
              <span className="w-[92px] shrink-0 text-ink-faint">{c.label}</span>
              <span className={c.ok ? "text-ink" : "font-medium text-ink"}>{c.detail}</span>
            </li>
          ))}
          <li className="pt-1 text-[12px] text-ink-muted">
            {needsAttention === 0
              ? "No field needs verification."
              : `${needsAttention} ${needsAttention === 1 ? "field requires" : "fields require"} verification.`}
            {dismissedCount > 0 && ` ${dismissedCount} dismissed.`}
          </li>
        </ul>
      </div>

      {result.issues.length > 0 && (
        <ul className={`space-y-2.5 border-t border-border px-7 py-5 ${analyzing ? "opacity-60" : ""}`}>
          {result.issues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              onReview={canReview(issue.field) ? () => onReview(issue.field) : undefined}
              onDismiss={issue.severity === "critical" ? undefined : () => onDismiss(issue.id)}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function IssueRow({
  issue,
  onReview,
  onDismiss,
}: {
  issue: QualityIssue;
  onReview?: () => void;
  onDismiss?: () => void;
}) {
  const s = SEVERITY[issue.severity];
  const Icon = s.icon;
  return (
    <li className={`flex flex-wrap items-start gap-3 rounded-xl px-4 py-3.5 ${s.tint}`}>
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.iconColor}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink">
          {issue.message}
          <span className="ml-2 text-[11.5px] font-medium text-ink-faint">
            {s.label} · {issue.fieldLabel}
          </span>
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-muted">{issue.explanation}</p>
      </div>
      {(onReview || onDismiss) && (
        <div className="flex shrink-0 items-center gap-1.5">
          {onReview && (
            <button
              type="button"
              onClick={onReview}
              className="transition-calm inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink ring-1 ring-inset ring-border hover:ring-border-strong"
            >
              <ScanSearch className="h-3.5 w-3.5" />
              Review field
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={`Dismiss: ${issue.message}`}
              className="transition-calm inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-ink-muted hover:bg-white/60 hover:text-ink"
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </button>
          )}
        </div>
      )}
    </li>
  );
}
