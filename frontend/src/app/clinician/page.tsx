"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { RxBadge } from "@/components/RxLine";
import { Card, CardHeader, SectionLabel } from "@/components/Card";
import { Sparkline } from "@/components/Sparkline";
import { ArtContinuity } from "@/components/Illustrations";
import { buildSummary } from "@/lib/summary";
import { EmptyState } from "@/components/EmptyState";
import { FigRecords } from "@/components/Figures";
import { accessLog, clinicianTabs, DEFAULT_PATIENT_ID } from "@/lib/demo-data";
import { useStore } from "@/lib/store";
import {
  ageFromDob,
  changesSinceLastVisit,
  conflictsForVisit,
  findAllergyConflicts,
  findPatientById,
  trendOf,
  visitsForPatient,
  vitalSeries,
  type VitalKey,
} from "@/lib/clinical";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Minus,
  Pill,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sigma,
  Timer,
  TriangleAlert,
} from "lucide-react";

const VITALS: { key: VitalKey; label: string; unit: string; lowerIsBetter: boolean }[] = [
  { key: "systolic", label: "Systolic BP", unit: "mmHg", lowerIsBetter: true },
  { key: "hba1c", label: "HbA1c", unit: "%", lowerIsBetter: true },
  { key: "weightKg", label: "Weight", unit: "kg", lowerIsBetter: true },
  { key: "heartRate", label: "Resting HR", unit: "bpm", lowerIsBetter: true },
];

export default function ClinicianPage() {
  return (
    <Suspense fallback={null}>
      <ClinicianRecord />
    </Suspense>
  );
}

function ClinicianRecord() {
  const { patients, visits: allVisits } = useStore();
  const searchParams = useSearchParams();

  // Falls back to Priya so every existing demo link keeps working.
  const patient =
    findPatientById(patients, searchParams.get("patient")) ??
    findPatientById(patients, DEFAULT_PATIENT_ID)!;

  const visits = visitsForPatient(allVisits, patient.id);
  const conflicts = findAllergyConflicts(visits, patient.allergies);
  const delta = changesSinceLastVisit(visits);
  const summary = buildSummary(patient, visits);
  const facilityCount = new Set(visits.map((v) => v.facility)).size;

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      {/* Patient anchor */}
      <div className="mesh-wide mb-7 overflow-hidden rounded-2xl shadow-deep">
        <div className="flex flex-wrap items-start justify-between gap-6 px-7 py-6">
          <div className="flex items-center gap-5">
            <Avatar name={patient.name} size="lg" tone="cream" />
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-display text-[30px] text-cream">{patient.name}</h1>
                <span className="nums font-mono text-[12.5px] tracking-wide text-sage-light">
                  {patient.id}
                </span>
              </div>
              <p className="mt-1.5 text-[13.5px] text-cream-muted">
                {ageFromDob(patient.dob)} yrs · {patient.gender} · {patient.facility},{" "}
                {patient.district}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {patient.conditions.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-white/[0.08] px-3 py-1 text-[11.5px] font-medium text-cream ring-1 ring-inset ring-white/10"
                  >
                    {c}
                  </span>
                ))}
                {patient.allergies.map((a) => (
                  <span
                    key={a.label}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(180,70,55,0.22)] px-3 py-1 text-[11.5px] font-semibold text-danger-lift ring-1 ring-inset ring-[rgba(240,176,165,0.25)]"
                  >
                    <TriangleAlert className="h-3 w-3" />
                    {a.label} allergy
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            {/* The doctor is already looking at the record when they need this */}
            <Link
              href={`/clinician/visit/new?patient=${patient.id}`}
              className="transition-calm inline-flex items-center gap-2 rounded-xl bg-cream px-4 py-2 text-[13px] font-semibold text-forest-deep hover:bg-white"
            >
              <Plus className="h-4 w-4" />
              Record a visit
            </Link>
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-3.5 py-2 text-[12.5px] font-medium text-success-lift ring-1 ring-inset ring-white/10">
              <ShieldCheck className="h-4 w-4" />
              Verified via QR consent token
            </div>
            <div className="nums flex items-center gap-1.5 text-[12px] text-cream-muted">
              <Timer className="h-3.5 w-3.5" />
              session expires in 4:12
            </div>
          </div>
        </div>
      </div>

      {/* A patient registered but not yet seen. Shown plainly rather than
          rendering an empty record as though it were a complete one. */}
      {visits.length === 0 && (
        <Card>
          <EmptyState
            art={<FigRecords className="h-full w-auto" />}
            title="No visits recorded yet"
            body={`${patient.name} has a record but has not been seen yet. Anything documented from here will appear on this timeline.`}
            action={{
              label: "Record their first visit",
              href: `/clinician/visit/new?patient=${patient.id}`,
            }}
          />
        </Card>
      )}

      {/* Allergy guard — fires when a prescription shares a drug class with
          a recorded allergy. Prototype logic, not clinical decision support. */}
      {conflicts.length > 0 && (
        <div className="mb-7 overflow-hidden rounded-2xl border border-danger bg-danger-tint">
          <div className="flex items-start gap-4 px-7 py-5">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-display text-[19px] text-danger">
                  Prescription conflicts with a recorded allergy
                </h2>
                <Badge tone="danger">
                  {conflicts.length} found
                </Badge>
              </div>
              <ul className="mt-3.5 space-y-2.5">
                {conflicts.map((c, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-xl bg-surface px-4 py-3 text-[13.5px]"
                  >
                    <Pill className="h-4 w-4 shrink-0 text-danger" />
                    <span className="font-semibold text-ink">
                      {c.prescription.drug} {c.prescription.strength}
                    </span>
                    <span className="text-ink-muted">
                      prescribed at {c.visit.facility} on {c.visit.display}
                    </span>
                    <span className="ml-auto rounded-full bg-danger-tint px-2.5 py-1 text-[11.5px] font-medium text-danger">
                      {c.prescription.drugClass} · {c.allergy.severity} allergy recorded{" "}
                      {c.allergy.recorded}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
                This is exactly the gap unified records close — the prescribing facility
                could not see the allergy noted at {patient.facility}.
              </p>
            </div>
          </div>
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] ${
          visits.length === 0 ? "hidden" : ""
        }`}
      >
        {/* Left column */}
        <div className="space-y-6">
          <Card accent>
            <CardHeader
              eyebrow={
                <Badge tone="sage">
                  <Sigma className="h-3 w-3" />
                  Generated summary
                </Badge>
              }
              title="Clinical summary"
              subtitle="Computed from this patient's record. Every claim is built from the visit it cites, so an unsourced sentence cannot be produced."
            />
            <div className="px-7 pb-7">
              {summary.empty ? (
                <p className="text-[13.5px] text-ink-faint">
                  Nothing to summarise yet — no visits are recorded.
                </p>
              ) : (
                <>
                  <p className="font-serif text-[18px] leading-[1.78] tracking-[0.003em] text-ink">
                    {summary.sentences.map((s, i) => (
                      <span key={i}>
                        <span className={s.tone === "alert" ? "text-danger" : undefined}>
                          {s.text}
                        </span>
                        {s.cites.map((n) => (
                          <Cite key={n} n={n} />
                        ))}{" "}
                      </span>
                    ))}
                  </p>
                  <div className="mt-6 border-t border-border pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SectionLabel>Sources</SectionLabel>
                      {summary.sources.map((v, i) => (
                        <Badge key={v.id} tone="outline">
                          {i + 1} · {v.display} · {v.facility}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Care timeline"
              subtitle={`${visits.length} ${visits.length === 1 ? "visit" : "visits"} across ${facilityCount} ${facilityCount === 1 ? "facility" : "facilities"}, most recent first`}
            />
            {/* One continuous trace across the years — the shape of the record
                below, kept faint so it never competes with it */}
            <div className="border-y border-border bg-canvas px-7 py-3">
              <ArtContinuity className="h-auto w-full text-sage opacity-45" />
            </div>
            <div className="px-7 pb-7 pt-6">
              <ol className="relative">
                {visits.map((visit, i) => {
                  const last = i === visits.length - 1;
                  const current = i === 0;
                  const visitConflicts = conflictsForVisit(visit, patient.allergies);

                  return (
                    <li key={visit.id} className="relative flex gap-5 pb-7 last:pb-0">
                      {!last && (
                        <span
                          className="absolute left-[5.5px] top-4 h-full w-px bg-gradient-to-b from-border-strong to-border"
                          aria-hidden
                        />
                      )}
                      <span
                        className={`relative z-10 mt-[6px] h-3 w-3 shrink-0 rounded-full ring-4 ring-surface ${
                          visitConflicts.length > 0
                            ? "bg-danger"
                            : current
                              ? "bg-forest-mid"
                              : visit.admission
                                ? "bg-warning"
                                : "border-2 border-sage-light bg-surface"
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[15px] font-semibold text-ink">
                            {visit.diagnosis}
                          </p>
                          <span className="nums text-[12px] text-ink-faint">
                            {visit.display}
                          </span>
                        </div>
                        <p className="mt-1 text-[12.5px] text-ink-faint">
                          {visit.facility}
                        </p>
                        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">
                          {visit.notes}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {visit.prescriptions.map((p) => {
                            const clash = visitConflicts.some(
                              (c) => c.prescription.drug === p.drug,
                            );
                            return (
                              <RxBadge key={p.drug} prescription={p} conflict={clash} />
                            );
                          })}
                          {visit.admission && <Badge tone="warning">ER admission</Badge>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* What changed since last visit */}
          {delta && (
            <Card tone="sage">
              <div className="px-7 py-6">
                <SectionLabel>Since last visit</SectionLabel>
                <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                  {delta.previous.display} → {delta.current.display}
                </p>
                <ul className="mt-4 space-y-2">
                  {delta.changes.map((change, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl bg-surface px-3.5 py-2.5"
                    >
                      {change.kind === "vital" ? (
                        <>
                          {change.better === true ? (
                            <ArrowDownRight className="mt-[3px] h-3.5 w-3.5 shrink-0 text-success" />
                          ) : change.better === false ? (
                            <ArrowUpRight className="mt-[3px] h-3.5 w-3.5 shrink-0 text-warning" />
                          ) : (
                            /* no clinical direction for this metric — stay neutral */
                            <Minus className="mt-[3px] h-3.5 w-3.5 shrink-0 text-ink-faint" />
                          )}
                          <span className="text-[12.5px] text-ink">
                            <span className="font-medium">{change.label}</span>{" "}
                            <span className="nums text-ink-muted">
                              {change.from} → {change.to}
                            </span>
                          </span>
                        </>
                      ) : change.kind === "started" ? (
                        <>
                          <Pill className="mt-[3px] h-3.5 w-3.5 shrink-0 text-forest-mid" />
                          <span className="text-[12.5px] text-ink">
                            Started <span className="font-medium">{change.label}</span>{" "}
                            <span className="text-ink-muted">{change.detail}</span>
                          </span>
                        </>
                      ) : change.kind === "stopped" ? (
                        <>
                          <Minus className="mt-[3px] h-3.5 w-3.5 shrink-0 text-ink-faint" />
                          <span className="text-[12.5px] text-ink">
                            Stopped <span className="font-medium">{change.label}</span>{" "}
                            <span className="text-ink-muted">{change.detail}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mt-[3px] h-3.5 w-3.5 shrink-0 text-sage" />
                          <span className="text-[12.5px] text-ink">
                            <span className="font-medium">{change.label}</span>{" "}
                            <span className="text-ink-muted">— {change.detail}</span>
                          </span>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          )}

          {/* Vitals as trends */}
          <Card>
            <CardHeader
              title="Vitals"
              subtitle={
                visits.length > 0
                  ? `Across ${visits.length} visits since ${visits[visits.length - 1].display}`
                  : "No readings recorded yet"
              }
            />
            <div className="divide-y divide-border border-t border-border">
              {VITALS.map((v) => {
                const series = vitalSeries(visits, v.key);
                if (series.length === 0) return null;
                const latest = series[series.length - 1];
                const first = series[0];
                const dir = trendOf(series);
                const improving = v.lowerIsBetter ? dir === "down" : dir === "up";

                return (
                  <div key={v.key} className="flex items-center gap-4 px-7 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11.5px] text-ink-faint">{v.label}</p>
                      <p className="mt-1 flex items-baseline gap-1">
                        <span className="nums text-display text-[23px] text-forest">
                          {v.key === "systolic"
                            ? `${latest.value}/${visits[0]?.vitals.diastolic ?? "—"}`
                            : latest.value}
                        </span>
                        <span className="text-[11.5px] font-medium text-ink-faint">
                          {v.unit}
                        </span>
                      </p>
                      <p className="nums mt-1 flex items-center gap-1 text-[11px] text-ink-faint">
                        {dir === "flat" ? (
                          <Minus className="h-3 w-3" />
                        ) : improving ? (
                          <ArrowDownRight className="h-3 w-3 text-success" />
                        ) : (
                          <ArrowUpRight className="h-3 w-3 text-warning" />
                        )}
                        from {first.value} in {first.display.split(" ").slice(-1)}
                      </p>
                    </div>
                    <div className="w-[108px] shrink-0">
                      <Sparkline series={series} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Access log"
              subtitle="Hash-chained — edits are detectable"
              action={<Badge tone="success">Verified</Badge>}
              divided
            />
            <ul className="divide-y divide-border">
              {accessLog.map((entry, i) => (
                <li key={i} className="flex items-center gap-3.5 px-7 py-3.5">
                  {entry.outcome === "granted" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0 text-danger" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">
                      {entry.who}
                    </p>
                    <p className="nums text-[11.5px] text-ink-faint">{entry.when}</p>
                  </div>
                  <Badge tone={entry.outcome === "granted" ? "success" : "danger"}>
                    {entry.outcome === "granted" ? "Granted" : "Denied"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Cite({ n }: { n: number }) {
  return (
    <sup className="relative -top-[0.45em] ml-[1.5px] inline-block cursor-help rounded-[3px] bg-sage-tint-strong px-[4px] font-sans text-[9.5px] font-bold leading-[1.55] text-forest-mid">
      {n}
    </sup>
  );
}
