import { Avatar } from "./Avatar";
import { ageFromDob } from "@/lib/clinical";
import type { Patient } from "@/lib/demo-data";
import { TriangleAlert } from "lucide-react";

/**
 * Condensed form of the patient anchor from /clinician, pinned to the top of
 * the visit-entry flow. The allergy badge stays visible through every step —
 * including the medicine step, which is the one that matters.
 */
export function PatientContextBar({
  patient,
  className = "",
}: {
  patient: Patient;
  className?: string;
}) {
  return (
    <div
      className={`mesh-wide overflow-hidden rounded-2xl shadow-deep ${className}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
        <div className="flex items-center gap-4">
          <Avatar name={patient.name} size="md" tone="cream" />
          <div>
            <div className="flex flex-wrap items-baseline gap-2.5">
              <p className="text-display text-[18px] text-cream">{patient.name}</p>
              <span className="nums font-mono text-[11.5px] text-sage-light">
                {patient.id}
              </span>
            </div>
            <p className="nums mt-0.5 text-[12.5px] text-cream-muted">
              {ageFromDob(patient.dob)} yrs · {patient.gender} · {patient.facility}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {patient.allergies.length === 0 ? (
            <span className="rounded-full bg-white/[0.08] px-3 py-1 text-[11.5px] text-cream-muted ring-1 ring-inset ring-white/10">
              No known allergies
            </span>
          ) : (
            patient.allergies.map((a) => (
              <span
                key={a.label}
                className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(180,70,55,0.22)] px-3 py-1 text-[11.5px] font-semibold text-danger-lift ring-1 ring-inset ring-[rgba(240,176,165,0.25)]"
              >
                <TriangleAlert className="h-3 w-3" />
                {a.label} allergy
              </span>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
