"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, PageTitle, SectionLabel } from "@/components/Card";
import { FigConsentCard } from "@/components/Figures";
import { QrScanner } from "@/components/QrScanner";
import { findPatientById, findPatientsByQuery } from "@/lib/clinical";
import { recordAccess } from "@/lib/auditLog";
import { useStore } from "@/lib/store";
import { clinicianTabs, type Patient } from "@/lib/demo-data";
import { ArrowRight, Clock, ScanLine, ShieldCheck, Siren } from "lucide-react";

/** No auth yet, so the acting clinician is fixed. The audit row is real
 *  regardless; only the name is a placeholder. */
const CLINICIAN = "Dr. R. Deshmukh";

const steps = [
  {
    n: "01",
    t: "Hold the patient's code to the camera",
    d: "The code carries only a patient id — nothing clinical, nothing sensitive on its own.",
  },
  {
    n: "02",
    t: "The server checks your role",
    d: "Your clinician rights are verified before a single record is read from the database.",
  },
  {
    n: "03",
    t: "A short-lived grant opens",
    d: "Access lasts five minutes and is written to the audit log whether it succeeds or fails.",
  },
];

export default function ScanPage() {
  const router = useRouter();
  const { patients } = useStore();
  const [notFoundId, setNotFoundId] = useState<string | null>(null);

  const [breakGlass, setBreakGlass] = useState(false);
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Patient | null>(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const matches = findPatientsByQuery(patients, query).slice(0, 5);

  /**
   * The QR encodes a patient id and nothing else. Finding a match opens the
   * record; not finding one is a legitimate outcome with its own screen, not
   * an error — a code can be valid and simply have no history behind it.
   */
  function handleDecode(value: string) {
    setNotFoundId(null);
    const patient = findPatientById(patients, value);

    if (patient) {
      // Fire-and-forget: navigation must not wait on the audit write, and a
      // logging failure must never stop a doctor opening a record.
      void recordAccess({
        patientId: patient.id,
        actor: CLINICIAN,
        action: "view_record",
        outcome: "granted",
      });
      router.push(`/clinician?patient=${patient.id}`);
      return;
    }

    setNotFoundId(value);
    router.push(`/clinician/not-found-record?patient=${encodeURIComponent(value)}`);
  }

  /**
   * Break-glass. A patient who cannot present a code — unconscious, no card,
   * phone lost — still needs treating, so the system must have a path that
   * does not depend on consent being given at that moment.
   *
   * The control is not refusal, it is accountability: a reason is mandatory,
   * the entry is written to the same hash-chained log as everything else, and
   * it is marked distinctly there rather than blending in.
   */
  async function openEmergency(patientId: string) {
    if (!reason.trim()) {
      setReasonError("A reason is required before emergency access");
      return;
    }
    setSubmitting(true);
    await recordAccess({
      patientId,
      actor: CLINICIAN,
      action: "emergency_access",
      outcome: "granted",
      reason: reason.trim(),
    });
    setSubmitting(false);
    router.push(`/clinician?patient=${patientId}&emergency=1`);
  }

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      <PageTitle
        eyebrow="Consent required"
        title="Scan a patient's code"
        subtitle="No record opens without a valid, unexpired consent token."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="flex flex-col items-center justify-center px-8 py-12">
          <div className="relative">
            {/* viewfinder */}
            <span className="absolute -left-5 -top-5 h-7 w-7 rounded-tl-lg border-l-2 border-t-2 border-sage" />
            <span className="absolute -right-5 -top-5 h-7 w-7 rounded-tr-lg border-r-2 border-t-2 border-sage" />
            <span className="absolute -bottom-5 -left-5 h-7 w-7 rounded-bl-lg border-b-2 border-l-2 border-sage" />
            <span className="absolute -bottom-5 -right-5 h-7 w-7 rounded-br-lg border-b-2 border-r-2 border-sage" />
            <FigConsentCard className="h-[220px] w-auto" />
          </div>

          <p className="mt-10 flex items-center gap-2 text-[13px] text-ink-muted">
            <ScanLine className="h-4 w-4 text-sage" />
            Waiting for a code…
          </p>

          {/* Real camera. Every simulated path below stays available, because a
              webcam failing on stage should not derail the demo. */}
          <QrScanner onDecode={handleDecode} className="mt-5" />

          {notFoundId && (
            <p className="mt-3 max-w-xs text-center text-[12.5px] leading-relaxed text-warning">
              Read code <span className="nums font-mono">{notFoundId}</span>, but no
              patient matches it.
            </p>
          )}

          <div className="mt-6 w-full border-t border-border pt-5">
            <p className="text-center text-[11px] font-semibold uppercase tracking-label text-ink-faint">
              Or simulate
            </p>
          </div>

          <Link
            href="/clinician"
            className="transition-calm mt-4 inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-[13.5px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
          >
            Simulate a successful scan
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link
              href="/denied"
              className="transition-calm text-[12.5px] text-ink-faint underline underline-offset-4 hover:text-ink-muted"
            >
              Simulate a scan without clinician rights
            </Link>
            <Link
              href="/clinician/not-found-record"
              className="transition-calm text-[12.5px] text-ink-faint underline underline-offset-4 hover:text-ink-muted"
            >
              Simulate a patient with no history
            </Link>
            <Link
              href="/clinician/register"
              className="transition-calm text-[12.5px] text-ink-faint underline underline-offset-4 hover:text-ink-muted"
            >
              New patient? Register them
            </Link>
            <Link
              href="/clinician/find"
              className="transition-calm text-[12.5px] text-ink-faint underline underline-offset-4 hover:text-ink-muted"
            >
              Lost their QR? Find them
            </Link>
          </div>

          {/* Break-glass. A patient who cannot present a code still needs
              treating, so refusal is not an option — accountability is. */}
          <div className="mt-6 w-full border-t border-border pt-5">
            {!breakGlass ? (
              <button
                type="button"
                onClick={() => setBreakGlass(true)}
                className="transition-calm mx-auto flex items-center gap-2 text-[12.5px] font-medium text-warning underline underline-offset-4 hover:text-ink"
              >
                <Siren className="h-3.5 w-3.5" />
                Can&apos;t scan this patient?
              </button>
            ) : (
              <div className="rounded-xl bg-warning-tint px-5 py-5 text-left">
                <div className="flex items-start gap-2.5">
                  <Siren className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <div>
                    <p className="text-[13.5px] font-semibold text-warning">
                      Emergency access
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                      For a patient who cannot consent — unconscious, no card, no
                      phone. The record opens, and a reason is written permanently
                      to the audit trail.
                    </p>
                  </div>
                </div>

                <input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setChosen(null);
                  }}
                  placeholder="Find the patient by name, phone or ID"
                  className="transition-calm mt-4 w-full rounded-xl bg-surface px-4 py-2.5 text-[13px] text-ink ring-1 ring-inset ring-border-strong placeholder:text-ink-faint focus:outline-none focus:ring-warning"
                />

                {query.trim() && !chosen && (
                  <ul className="mt-2 space-y-1">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setChosen(p);
                            setQuery(p.name);
                          }}
                          className="transition-calm w-full rounded-lg bg-surface px-3.5 py-2 text-left text-[13px] text-ink hover:bg-canvas"
                        >
                          {p.name}{" "}
                          <span className="nums text-[11.5px] text-ink-faint">
                            {p.id}
                          </span>
                        </button>
                      </li>
                    ))}
                    {matches.length === 0 && (
                      <li className="px-1 py-2 text-[12.5px] text-ink-faint">
                        No patient matches that.
                      </li>
                    )}
                  </ul>
                )}

                <textarea
                  value={reason}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReasonError(null);
                  }}
                  rows={2}
                  placeholder="Why is emergency access needed? (required)"
                  className="transition-calm mt-3 w-full resize-y rounded-xl bg-surface px-4 py-2.5 text-[13px] text-ink ring-1 ring-inset ring-border-strong placeholder:text-ink-faint focus:outline-none focus:ring-warning"
                />
                {reasonError && (
                  <p className="mt-1.5 text-[12px] text-danger">{reasonError}</p>
                )}

                <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    disabled={!chosen || submitting}
                    onClick={() => chosen && void openEmergency(chosen.id)}
                    className="transition-calm inline-flex items-center gap-2 rounded-xl bg-warning px-4 py-2 text-[13px] font-semibold text-cream hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Siren className="h-3.5 w-3.5" />
                    {submitting ? "Logging…" : "Open record and log the reason"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setBreakGlass(false);
                      setQuery("");
                      setChosen(null);
                      setReason("");
                      setReasonError(null);
                    }}
                    className="transition-calm text-[12.5px] text-ink-muted underline underline-offset-4 hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="px-7 py-6">
              <SectionLabel>What happens on scan</SectionLabel>
              <ol className="mt-5 space-y-5">
                {steps.map((s) => (
                  <li key={s.n} className="flex gap-4">
                    <span className="nums text-[11px] font-semibold text-sage">
                      {s.n}
                    </span>
                    <div>
                      <p className="text-[14px] font-semibold text-ink">{s.t}</p>
                      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                        {s.d}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          <Card tone="sage">
            <div className="flex items-start gap-3.5 px-7 py-6">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-forest-mid" />
              <div>
                <p className="text-[14px] font-semibold text-ink">
                  Modelled on ABHA consent tokens
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                  The code is a permanent patient id, like a hospital card. The access
                  itself is granted fresh at scan time and tied to who is scanning.
                </p>
                <p className="nums mt-3 flex items-center gap-1.5 text-[12px] text-ink-faint">
                  <Clock className="h-3.5 w-3.5" />
                  grants expire after 5 minutes · single use
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
