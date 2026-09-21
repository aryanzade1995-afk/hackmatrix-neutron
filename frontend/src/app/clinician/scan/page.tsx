"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, PageTitle, SectionLabel } from "@/components/Card";
import { FigConsentCard } from "@/components/Figures";
import { QrScanner } from "@/components/QrScanner";
import { findPatientById } from "@/lib/clinical";
import { useStore } from "@/lib/store";
import { clinicianTabs } from "@/lib/demo-data";
import { ArrowRight, Clock, ScanLine, ShieldCheck } from "lucide-react";

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

  /**
   * The QR encodes a patient id and nothing else. Finding a match opens the
   * record; not finding one is a legitimate outcome with its own screen, not
   * an error — a code can be valid and simply have no history behind it.
   */
  function handleDecode(value: string) {
    setNotFoundId(null);
    const patient = findPatientById(patients, value);
    if (patient) {
      router.push(`/clinician?patient=${patient.id}`);
      return;
    }
    setNotFoundId(value);
    router.push(`/clinician/not-found-record?patient=${encodeURIComponent(value)}`);
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
