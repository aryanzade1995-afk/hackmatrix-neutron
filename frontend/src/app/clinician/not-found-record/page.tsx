"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Card, PageTitle } from "@/components/Card";
import { PatientLookupState } from "@/components/PatientLookupState";
import { clinicianTabs } from "@/lib/demo-data";
import { usePatientLookup } from "@/lib/patientLookup";
import { ArrowRight, Info } from "lucide-react";

/**
 * Where a scan lands when the code matches no registered patient.
 *
 * This page used to say "Code accepted — the consent token was valid" for any
 * code at all, and offered "Record the first visit" for the unknown id, which
 * opened the visit form for a default patient instead. A code that matches
 * nobody is not a valid token; it is shown here exactly as it was read, the
 * attempt is in the audit log as refused, and the ways forward are the ones
 * that cannot attach a visit to the wrong person.
 */
export default function UnknownCodePage() {
  return (
    <Suspense fallback={null}>
      <UnknownCodeView />
    </Suspense>
  );
}

function UnknownCodeView() {
  const searchParams = useSearchParams();
  // `patient` is the older parameter name; links written before the rename
  // still land here correctly.
  const code = (searchParams.get("code") ?? searchParams.get("patient") ?? "").trim();
  const lookup = usePatientLookup(code || null);

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      <PageTitle
        eyebrow="Code not recognised"
        title="No record opened"
        subtitle="The scanned code does not match any registered patient."
      />

      {code && (
        <p className="mb-5 flex max-w-2xl items-start gap-2 rounded-xl bg-sage-tint px-4 py-3 text-[12.5px] leading-relaxed text-ink-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-forest-mid" />
          <span>
            The code read as{" "}
            <span className="nums break-all font-mono text-ink">{code}</span>. Patient codes
            look like <span className="nums font-mono">PT-2291</span>. This attempt was
            recorded in the audit log as refused.
          </span>
        </p>
      )}

      {lookup.status === "found" ? (
        // Reached by hand with an id that does exist: say so, but opening the
        // record still goes through a scan or a search, which log the access.
        <Card className="px-7 py-6">
          <p className="text-[14px] font-semibold text-ink">
            {lookup.patient.id} is registered to {lookup.patient.name}.
          </p>
          <Link
            href="/clinician/scan"
            className="transition-calm mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream hover:bg-forest-deep"
          >
            Scan their code to open the record
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>
      ) : (
        <PatientLookupState
          lookup={
            lookup.status === "none"
              ? { status: "missing", id: "this code", offline: searchParams.get("offline") === "1" }
              : lookup.status === "missing"
                ? { ...lookup, offline: lookup.offline || searchParams.get("offline") === "1" }
                : lookup
          }
        />
      )}
    </AppShell>
  );
}
