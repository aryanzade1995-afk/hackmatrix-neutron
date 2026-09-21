"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { EmptyState } from "@/components/EmptyState";
import { FigRecords } from "@/components/Figures";
import { ageFromDob, overdueFollowUps } from "@/lib/clinical";
import { useStore } from "@/lib/store";
import { clinicianTabs, FACILITIES } from "@/lib/demo-data";
import { ArrowRight, CalendarClock, Info, Pill } from "lucide-react";

const THRESHOLDS = [
  { label: "90 days", value: 90 },
  { label: "6 months", value: 180 },
  { label: "1 year", value: 365 },
];

function monthYear(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

export default function FollowUpsPage() {
  const { patients, visits } = useStore();
  const [facility, setFacility] = useState(FACILITIES[0]);
  const [threshold, setThreshold] = useState(90);

  const gaps = useMemo(
    () => overdueFollowUps(patients, visits, facility, threshold),
    [patients, visits, facility, threshold],
  );

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      <PageTitle
        eyebrow="Attendance gaps"
        title="Overdue follow-ups"
        subtitle="Patients on a long-term medicine who have not been seen for a while. This reports attendance only — it makes no clinical judgment about whether a given gap matters."
        action={<Badge tone="sage">{gaps.length} found</Badge>}
      />

      <Card className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-5 px-7 py-5">
          <div>
            <p className="text-[11.5px] font-medium text-ink-muted">Facility</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {FACILITIES.map((f) => (
                <Chip
                  key={f}
                  label={f}
                  selected={facility === f}
                  onClick={() => setFacility(f)}
                />
              ))}
            </div>
          </div>
          <div>
            <p className="text-[11.5px] font-medium text-ink-muted">Not seen for</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {THRESHOLDS.map((t) => (
                <Chip
                  key={t.value}
                  label={t.label}
                  selected={threshold === t.value}
                  onClick={() => setThreshold(t.value)}
                />
              ))}
            </div>
          </div>
        </div>
        {/* Stated plainly, consistent with how the rest of the project
            documents what authentication does not yet do. */}
        <p className="flex items-start gap-2 border-t border-border px-7 py-3.5 text-[12px] leading-relaxed text-ink-faint">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          There is no authentication yet, so the facility is chosen here rather than
          derived from who is signed in.
        </p>
      </Card>

      <Card>
        <CardHeader
          title={`Patients at ${facility}`}
          subtitle="On an open-ended prescription, longest gap first. A finished course is not counted."
          divided
        />

        {gaps.length === 0 ? (
          <EmptyState
            art={<FigRecords className="h-full w-auto" />}
            title="Nobody is overdue here"
            body={`Every patient at ${facility} on a long-term medicine has been seen within ${threshold} days.`}
          />
        ) : (
          <ul className="divide-y divide-border">
            {gaps.map((gap) => (
              <li
                key={gap.patient.id}
                className="flex flex-wrap items-center justify-between gap-4 px-7 py-4"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <Avatar name={gap.patient.name} size="md" tone="sage" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <p className="text-[14.5px] font-semibold text-ink">
                        {gap.patient.name}
                      </p>
                      <span className="nums font-mono text-[11.5px] text-ink-faint">
                        {gap.patient.id}
                      </span>
                      <span className="nums text-[12px] text-ink-faint">
                        {ageFromDob(gap.patient.dob)} yrs
                      </span>
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-muted">
                      <Pill className="h-3.5 w-3.5 text-sage" />
                      on {gap.drug} since {monthYear(gap.ongoingSince)}
                      <span className="text-ink-faint">·</span>
                      <span className="nums">
                        last seen {gap.lastVisit.display}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span
                    className={`nums inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium ${
                      gap.daysSinceLastVisit >= 365
                        ? "bg-danger-tint text-danger"
                        : "bg-warning-tint text-warning"
                    }`}
                  >
                    <CalendarClock className="h-3.5 w-3.5" />
                    {gap.daysSinceLastVisit} days
                  </span>
                  <Link
                    href={`/clinician/visit/new?patient=${gap.patient.id}`}
                    className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2 text-[13px] font-semibold text-cream hover:bg-forest-deep"
                  >
                    Record a visit
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </AppShell>
  );
}
