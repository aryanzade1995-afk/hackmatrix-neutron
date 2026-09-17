import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle } from "@/components/Card";
import { clinicianTabs, patient, visits } from "@/lib/demo-data";

export default function ClinicianHistoryPage() {
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
          {visits.map((visit, i) => (
            <li key={i} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-4">
                  <span className="w-24 shrink-0 pt-0.5 text-xs text-ink-faint">
                    {visit.date}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-ink">{visit.diagnosis}</p>
                    <p className="text-xs text-ink-muted">{visit.facility}</p>
                    <p className="mt-1.5 text-sm text-ink-muted">{visit.notes}</p>
                  </div>
                </div>
                <Badge tone="neutral">{visit.prescription}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
