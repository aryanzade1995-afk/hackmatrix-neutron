"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Card, PageTitle } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { PatientQrPanel } from "@/components/PatientQrPanel";
import { FigRecords } from "@/components/Figures";
import { ageFromDob, findPatientsByQuery } from "@/lib/clinical";
import { useStore } from "@/lib/store";
import { clinicianTabs, type Patient } from "@/lib/demo-data";
import { ArrowRight, QrCode, Search, X } from "lucide-react";

export default function FindPatientPage() {
  const { patients } = useStore();
  const [query, setQuery] = useState("");
  const [reissueFor, setReissueFor] = useState<Patient | null>(null);

  const results = findPatientsByQuery(patients, query);
  const searching = query.trim().length > 0;

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      <PageTitle
        eyebrow="Lost or no QR code"
        title="Find a patient"
        subtitle="Search by name, phone, or patient ID instead of scanning."
      />

      <Card>
        <div className="px-7 pb-2 pt-7">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, phone number, or patient ID"
              autoFocus
              className="transition-calm w-full rounded-xl bg-canvas py-3 pl-11 pr-4 text-[13.5px] text-ink ring-1 ring-inset ring-border placeholder:text-ink-faint focus:outline-none focus:ring-border-strong"
            />
          </div>
        </div>

        {!searching && (
          <EmptyState
            art={<FigRecords className="h-full w-auto" />}
            title="Search for a patient"
            body="Open their record or reissue their QR code — useful when a patient arrives without their card."
          />
        )}

        {searching && results.length === 0 && (
          <EmptyState
            art={<FigRecords className="h-full w-auto" />}
            title="No patient matches that search"
            body="Try their phone number instead of their name — spellings vary between facilities."
          />
        )}

        {searching && results.length > 0 && (
          <ul className="mt-5 divide-y divide-border border-t border-border">
            {results.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-4 px-7 py-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar name={p.name} size="md" tone="sage" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <p className="text-[14.5px] font-semibold text-ink">{p.name}</p>
                      <span className="nums font-mono text-[11.5px] text-ink-faint">
                        {p.id}
                      </span>
                    </div>
                    <p className="nums mt-0.5 text-[12.5px] text-ink-muted">
                      {ageFromDob(p.dob)} yrs · {p.gender} · {p.facility}
                      {p.phone && ` · ${p.phone}`}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                  <Link
                    href={`/clinician?patient=${p.id}`}
                    className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream hover:bg-forest-deep"
                  >
                    Open record
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <button
                    type="button"
                    onClick={() => setReissueFor(reissueFor?.id === p.id ? null : p)}
                    className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    Resend QR
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {reissueFor && (
        <Card className="mt-6">
          <div className="px-7 py-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-display text-[19px] text-ink">Reissued QR code</p>
                <p className="mt-1.5 text-[12.5px] text-ink-muted">
                  Same permanent identifier — reissuing does not change it, and does not
                  grant access on its own.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReissueFor(null)}
                aria-label="Close"
                className="transition-calm rounded-lg p-1.5 text-ink-faint hover:bg-canvas hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PatientQrPanel
              patientId={reissueFor.id}
              patientName={reissueFor.name}
              patientPhone={reissueFor.phone}
              className="mt-5"
            />
          </div>
        </Card>
      )}
    </AppShell>
  );
}
