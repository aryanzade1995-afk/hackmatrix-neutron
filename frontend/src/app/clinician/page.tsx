import { AppShell } from "@/components/AppShell";
import { Avatar } from "@/components/Avatar";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, SectionLabel } from "@/components/Card";
import { accessLog, clinicianTabs, patient, visits } from "@/lib/demo-data";
import {
  ArrowDownRight,
  CheckCircle2,
  Minus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  TriangleAlert,
} from "lucide-react";

const vitals = [
  { label: "Blood pressure", value: "138/86", unit: "mmHg", trend: "down" as const },
  { label: "HbA1c", value: "6.8", unit: "%", trend: "flat" as const },
  { label: "Weight", value: "64", unit: "kg", trend: "flat" as const },
  { label: "Resting HR", value: "78", unit: "bpm", trend: "flat" as const },
];

export default function ClinicianPage() {
  const facilityCount = new Set(visits.map((v) => v.facility)).size;

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      {/* Patient anchor */}
      <div className="mesh-wide mb-7 overflow-hidden rounded-2xl shadow-deep">
        <div className="flex flex-wrap items-start justify-between gap-6 px-7 py-6">
          <div className="flex items-center gap-5">
            <Avatar name={patient.name} size="lg" tone="cream" />
            <div>
              <div className="flex flex-wrap items-baseline gap-3">
                <h1 className="text-display text-[30px] text-cream">{patient.name}</h1>
                <span className="nums font-mono text-[12.5px] tracking-wide text-sage-light">
                  {patient.id}
                </span>
              </div>
              <p className="mt-1.5 text-[13.5px] text-cream-muted">
                {patient.age} yrs · {patient.gender} · {patient.facility},{" "}
                {patient.district}
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {patient.conditions.map((c) => (
                  <span
                    key={c}
                    className="rounded-full bg-white/[0.08] px-3 py-1 text-[11.5px] font-medium text-cream ring-1 ring-inset ring-white/10"
                  >
                    {c}
                  </span>
                ))}
                {patient.allergies.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(180,70,55,0.22)] px-3 py-1 text-[11.5px] font-semibold text-danger-lift ring-1 ring-inset ring-[rgba(240,176,165,0.25)]"
                  >
                    <TriangleAlert className="h-3 w-3" />
                    {a} allergy
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2.5">
            <div className="flex items-center gap-2 rounded-xl bg-white/[0.08] px-3.5 py-2 text-[12.5px] font-medium text-success-lift ring-1 ring-inset ring-white/10">
              <ShieldCheck className="h-4 w-4" />
              Verified via QR consent token
            </div>
            <div className="nums flex items-center gap-1.5 text-[12px] text-cream-muted">
              <Timer className="h-3.5 w-3.5" />
              session expires in 4:12
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        {/* Left column */}
        <div className="space-y-6">
          <Card accent>
            <CardHeader
              eyebrow={
                <Badge tone="sage">
                  <Sparkles className="h-3 w-3" />
                  AI-generated
                </Badge>
              }
              title="Clinical summary"
              subtitle="Each claim cites the visit it came from. Sentences without a source are dropped before display."
            />
            <div className="px-7 pb-7">
              <p className="font-serif text-[18px] leading-[1.78] tracking-[0.003em] text-ink">
                Priya has been managing type 2 diabetes on metformin for over three
                years, with her most recent follow-up showing stable control
                <Cite n={1} />. She has had two emergency admissions for hypertensive
                episodes, most recently in March 2026
                <Cite n={2} />, and is currently on amlodipine
                <Cite n={2} />. She has a recorded allergy to penicillin
                <Cite n={3} /> — avoid penicillin-class antibiotics.
              </p>
              <div className="mt-6 border-t border-border pt-4">
                <div className="flex flex-wrap items-center gap-2">
                  <SectionLabel>Sources</SectionLabel>
                  <Badge tone="outline">1 · Visit 12 Aug 2026</Badge>
                  <Badge tone="outline">2 · Visit 03 Mar 2026</Badge>
                  <Badge tone="outline">3 · Visit 02 Jun 2023</Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Care timeline"
              subtitle={`${visits.length} visits across ${facilityCount} facilities, most recent first`}
            />
            <div className="px-7 pb-7">
              <ol className="relative">
                {visits.map((visit, i) => {
                  const last = i === visits.length - 1;
                  const current = i === 0;
                  return (
                    <li key={i} className="relative flex gap-5 pb-7 last:pb-0">
                      {!last && (
                        <span
                          className="absolute left-[5.5px] top-4 h-full w-px bg-gradient-to-b from-border-strong to-border"
                          aria-hidden
                        />
                      )}
                      <span
                        className={`relative z-10 mt-[6px] h-3 w-3 shrink-0 rounded-full ring-4 ring-surface ${
                          current
                            ? "bg-forest-mid ring-offset-0"
                            : "border-2 border-sage-light bg-surface"
                        }`}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[15px] font-semibold text-ink">
                            {visit.diagnosis}
                          </p>
                          <span className="nums text-[12px] text-ink-faint">
                            {visit.date}
                          </span>
                        </div>
                        <p className="mt-1 text-[12.5px] text-ink-faint">
                          {visit.facility}
                        </p>
                        <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-muted">
                          {visit.notes}
                        </p>
                        <div className="mt-3">
                          <Badge tone="neutral">Rx · {visit.prescription}</Badge>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </Card>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <Card tone="sage">
            <div className="px-7 py-6">
              <SectionLabel>Flagged for attention</SectionLabel>
              <div className="mt-4 space-y-2.5">
                <Flag
                  tone="danger"
                  icon={TriangleAlert}
                  title="Penicillin allergy"
                  body="Recorded 02 Jun 2023. Avoid penicillin-class antibiotics."
                />
                <Flag
                  tone="warning"
                  icon={ShieldAlert}
                  title="Two ER admissions"
                  body="Hypertensive episodes within 16 months."
                />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Latest vitals" subtitle="Recorded 12 Aug 2026" />
            <dl className="grid grid-cols-2 gap-px border-t border-border bg-border">
              {vitals.map((v) => (
                <div key={v.label} className="bg-surface px-7 py-5">
                  <dt className="text-[11.5px] text-ink-faint">{v.label}</dt>
                  <dd className="mt-1.5 flex items-baseline gap-1">
                    <span className="nums text-display text-[24px] text-forest">
                      {v.value}
                    </span>
                    <span className="text-[11.5px] font-medium text-ink-faint">
                      {v.unit}
                    </span>
                  </dd>
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-ink-faint">
                    {v.trend === "down" ? (
                      <ArrowDownRight className="h-3 w-3 text-success" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {v.trend === "down" ? "improving" : "stable"}
                  </p>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Access log"
              subtitle="Hash-chained — edits are detectable"
              action={<Badge tone="success">Verified</Badge>}
              divided
            />
            <ul className="divide-y divide-border">
              {accessLog.map((entry, i) => (
                <li key={i} className="flex items-center gap-3.5 px-7 py-3.5">
                  {entry.outcome === "granted" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 shrink-0 text-danger" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">
                      {entry.who}
                    </p>
                    <p className="nums text-[11.5px] text-ink-faint">{entry.when}</p>
                  </div>
                  <Badge tone={entry.outcome === "granted" ? "success" : "danger"}>
                    {entry.outcome === "granted" ? "Granted" : "Denied"}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function Flag({
  tone,
  icon: Icon,
  title,
  body,
}: {
  tone: "danger" | "warning";
  icon: React.ElementType;
  title: string;
  body: string;
}) {
  const classes =
    tone === "danger"
      ? { box: "bg-danger-tint", icon: "text-danger", title: "text-danger" }
      : { box: "bg-warning-tint", icon: "text-warning", title: "text-warning" };

  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3.5 ${classes.box}`}>
      <Icon className={`mt-[3px] h-4 w-4 shrink-0 ${classes.icon}`} />
      <div>
        <p className={`text-[13.5px] font-semibold ${classes.title}`}>{title}</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">{body}</p>
      </div>
    </div>
  );
}

function Cite({ n }: { n: number }) {
  return (
    <sup className="relative -top-[0.45em] ml-[1.5px] inline-block cursor-help rounded-[3px] bg-sage-tint-strong px-[4px] font-sans text-[9.5px] font-bold leading-[1.55] text-forest-mid">
      {n}
    </sup>
  );
}
