"use client";

import Link from "next/link";
import { Loader2, ScanLine, Search, UserPlus } from "lucide-react";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { FigRecords } from "./Figures";
import type { PatientLookup } from "@/lib/patientLookup";

/**
 * What a record screen shows instead of a record: while the patient is being
 * looked up, when nobody matches the id, and when no id was given at all.
 * Never a different patient's record in their place.
 */
export function PatientLookupState({
  lookup,
}: {
  lookup: Exclude<PatientLookup, { status: "found" }>;
}) {
  if (lookup.status === "loading") {
    return (
      <Card>
        <p className="flex items-center gap-2.5 px-7 py-12 text-[13.5px] text-ink-muted" role="status">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening the record for <span className="nums font-mono">{lookup.id}</span>…
        </p>
      </Card>
    );
  }

  const title =
    lookup.status === "none" ? "No record open" : `No patient matches ${lookup.id}`;
  const body =
    lookup.status === "none"
      ? "Scan the patient's code to open their record, or find them by name or phone."
      : lookup.offline
        ? "The records server cannot be reached, and this id is not among the records held on this device. Check the connection, or find the patient another way."
        : "Nothing is registered under this id. Check the code, find the patient by name or phone, or register them if this is their first visit.";

  return (
    <Card>
      <EmptyState
        art={<FigRecords className="h-full w-auto" />}
        title={title}
        body={body}
        note={
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link
              href="/clinician/scan"
              className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream hover:bg-forest-deep"
            >
              <ScanLine className="h-4 w-4" />
              Scan a code
            </Link>
            <Link
              href="/clinician/find"
              className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
            >
              <Search className="h-4 w-4" />
              Find patient
            </Link>
            {lookup.status === "missing" && (
              <Link
                href="/clinician/register"
                className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
              >
                <UserPlus className="h-4 w-4" />
                Register a patient
              </Link>
            )}
          </div>
        }
      />
    </Card>
  );
}
