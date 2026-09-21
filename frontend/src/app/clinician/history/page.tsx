"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RxBadge } from "@/components/RxLine";
import { Card, CardHeader, PageTitle } from "@/components/Card";
import { clinicianTabs, DEFAULT_PATIENT_ID } from "@/lib/demo-data";
import { useStore } from "@/lib/store";
import {
  conflictsForVisit,
  findPatientById,
  formatBp,
  visitsForPatient,
} from "@/lib/clinical";
import { TriangleAlert } from "lucide-react";

export default function ClinicianHistoryPage() {
  return (
    <Suspense fallback={null}>
      <HistoryView />
    </Suspense>
  );
}

function HistoryView() {
  const { patients, visits: allVisits } = useStore();
  const searchParams = useSearchParams();

  const patient =
    findPatientById(patients, searchParams.get("patient")) ??
    findPatientById(patients, DEFAULT_PATIENT_ID)!;
  const visits = visitsForPatient(allVisits, patient.id);

  return (
    <AppShell role="clinician" userName="R. Deshmukh" tabs={clinicianTabs}>
      <PageTitle
        eyebrow={`${patient.name} · ${patient.id}`}
        title="Visit history"
        subtitle={`${visits.length} recorded visits across ${
          new Set(visits.map((v) => v.facility)).size
        } facilities`}
      />

      <Card>
        <CardHeader
          title="All visits"
          subtitle="Most recent first, across every facility that has treated this patient"
        />
        <ul className="divide-y divide-border">
          {visits.map((visit) => {
            const clashes = conflictsForVisit(visit, patient.allergies);
            return (
              <li key={visit.id} className="px-7 py-5">
                <div className="flex items-start justify-between gap-5">
                  <div className="flex gap-5">
                    <span className="nums w-24 shrink-0 pt-0.5 text-[12px] text-ink-faint">
                      {visit.display}
                    </span>
                    <div>
                      <p className="text-[14.5px] font-semibold text-ink">
                        {visit.diagnosis}
                      </p>
                      <p className="text-[12.5px] text-ink-faint">{visit.facility}</p>
                      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-muted">
                        {visit.notes}
                      </p>
                      <p className="nums mt-2 text-[12px] text-ink-faint">
                        BP {formatBp(visit.vitals)} · {visit.vitals.weightKg} kg ·{" "}
                        {visit.vitals.heartRate} bpm
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {visit.prescriptions.map((p) => {
                      const clash = clashes.some((c) => c.prescription.drug === p.drug);
                      return (
                        <RxBadge key={p.drug} prescription={p} conflict={clash} />
                      );
                    })}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </AppShell>
  );
}
