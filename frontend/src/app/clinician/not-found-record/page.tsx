"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, PageTitle } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { FigRecords } from "@/components/Figures";
import { clinicianTabs, DEFAULT_PATIENT_ID } from "@/lib/demo-data";
import { Info } from "lucide-react";

/**
 * A valid code for a patient who has no history yet — a first-ever visit, or
 * a patient whose past care was never digitised. Worth showing plainly rather
 * than presenting an empty record as if it were a complete one.
 */
export default function NoRecordPage() {
  return (
    <Suspense fallback={null}>
      <NoRecordView />
    </Suspense>
  );
}

function NoRecordView() {
  const searchParams = useSearchParams();
  const patientId = searchParams.get("patient") ?? DEFAULT_PATIENT_ID;

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      <PageTitle
        eyebrow="Code accepted"
        title="No history on file"
        subtitle="The consent token was valid — there is simply nothing recorded against it yet."
      />

      <Card>
        <EmptyState
          art={<FigRecords className="h-full w-auto" />}
          title="This patient has no recorded visits"
          body="Either this is their first registered visit, or their earlier care was never entered into a connected system."
          action={{
            label: "Record the first visit",
            href: `/clinician/visit/new?patient=${patientId}`,
          }}
          note={
            <p className="inline-flex max-w-md items-start gap-2 rounded-xl bg-sage-tint px-4 py-3 text-left text-[12.5px] leading-relaxed text-ink-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-forest-mid" />
              An empty record is not the same as a healthy one. Ask the patient directly
              rather than assuming nothing happened.
            </p>
          }
        />
      </Card>
    </AppShell>
  );
}
