"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mark } from "@/components/Mark";
import { ageFromDob, findPatientById, visitsForPatient } from "@/lib/clinical";
import { computeSummaryFacts, renderPatientSummary } from "@/lib/summary";
import { useStore } from "@/lib/store";
import { DEFAULT_PATIENT_ID } from "@/lib/demo-data";
import { ArrowLeft, Pill, Printer, TriangleAlert } from "lucide-react";

/**
 * Meant to be turned toward the patient or printed and handed over, so it
 * deliberately drops the clinician chrome — no tabs, no navigation, larger
 * type. The only clinician affordances are a back link and a print button,
 * both hidden when printing.
 */
export default function PatientSummaryPage() {
  return (
    <Suspense fallback={null}>
      <PatientSummaryView />
    </Suspense>
  );
}

function PatientSummaryView() {
  const { patients, visits: allVisits } = useStore();
  const searchParams = useSearchParams();

  const patient =
    findPatientById(patients, searchParams.get("patient")) ??
    findPatientById(patients, DEFAULT_PATIENT_ID)!;

  const visits = visitsForPatient(allVisits, patient.id);
  const summary = renderPatientSummary(computeSummaryFacts(patient, visits));

  return (
    <div className="min-h-screen bg-canvas">
      <div className="mx-auto max-w-[760px] px-8 py-10">
        {/* Clinician affordances — never printed */}
        <div className="mb-8 flex items-center justify-between print:hidden">
          <Link
            href={`/clinician?patient=${patient.id}`}
            className="transition-calm inline-flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to record
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream hover:bg-forest-deep"
          >
            <Printer className="h-3.5 w-3.5" />
            Print for patient
          </button>
        </div>

        <article className="rounded-2xl border border-border bg-surface px-10 py-10 shadow-card print:border-0 print:shadow-none">
          <div className="flex items-center gap-2.5 border-b border-border pb-6">
            <Mark className="h-5 w-5 text-forest" />
            <span className="font-serif text-[15px] font-semibold tracking-tight text-forest-deep">
              Hackmatrix
            </span>
            <span className="ml-auto nums text-[12px] text-ink-faint">
              {patient.id} · {ageFromDob(patient.dob)} yrs
            </span>
          </div>

          {summary.empty ? (
            <p className="mt-8 text-[16px] text-ink-muted">
              There is nothing recorded for you yet. This summary will fill in after
              your first visit.
            </p>
          ) : (
            <>
              <h1 className="text-display mt-8 text-[30px] text-ink">
                {summary.greeting}
              </h1>

              <div className="mt-5 space-y-4">
                {summary.paragraphs.map((p, i) => (
                  <p key={i} className="text-[17px] leading-[1.7] text-ink">
                    {p}
                  </p>
                ))}
              </div>

              {summary.medicines.length > 0 && (
                <section className="mt-9">
                  <h2 className="text-display text-[19px] text-ink">
                    Medicines you are taking
                  </h2>
                  <ul className="mt-4 space-y-2.5">
                    {summary.medicines.map((m) => (
                      <li
                        key={m.line}
                        className="flex items-start gap-3.5 rounded-xl bg-sage-tint px-5 py-4"
                      >
                        <Pill className="mt-0.5 h-[18px] w-[18px] shrink-0 text-forest-mid" />
                        <div>
                          <p className="text-[16px] font-semibold text-ink">{m.line}</p>
                          <p className="mt-0.5 text-[15px] text-ink-muted">{m.detail}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {summary.allergyWarnings.length > 0 && (
                <section className="mt-9">
                  {summary.allergyWarnings.map((w, i) => (
                    <p
                      key={i}
                      className="flex items-start gap-3.5 rounded-xl bg-danger-tint px-5 py-4 text-[16px] leading-relaxed text-danger"
                    >
                      <TriangleAlert className="mt-0.5 h-[18px] w-[18px] shrink-0" />
                      {w}
                    </p>
                  ))}
                </section>
              )}
            </>
          )}

          {/* Always visible, never behind a tooltip or a fold */}
          <p className="mt-10 border-t border-border pt-6 text-[13px] leading-relaxed text-ink-muted">
            {summary.disclaimer}
          </p>
        </article>
      </div>
    </div>
  );
}
