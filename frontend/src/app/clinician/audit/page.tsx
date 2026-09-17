import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle } from "@/components/Card";
import { accessLog, clinicianTabs } from "@/lib/demo-data";
import { CheckCircle2, Link2, ShieldAlert } from "lucide-react";

export default function ClinicianAuditPage() {
  return (
    <AppShell role="clinician" userName="R. Deshmukh" tabs={clinicianTabs}>
      <PageTitle
        eyebrow="Tamper-evident record"
        title="Audit log"
        subtitle="Every access attempt is recorded, including the ones that were refused."
        action={
          <div className="flex items-center gap-2 rounded-xl bg-success-tint px-3.5 py-2 text-[12.5px] font-medium text-success">
            <Link2 className="h-3.5 w-3.5" />
            <span>Hash chain verified · no rows altered</span>
          </div>
        }
      />

      <Card>
        <CardHeader
          title="Access attempts"
          subtitle="Each row stores a hash of itself plus the previous row, so edits are detectable"
        />
        <ul className="divide-y divide-border">
          {accessLog.map((entry, i) => (
            <li key={i} className="flex items-center gap-4 px-5 py-3.5">
              {entry.outcome === "granted" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <ShieldAlert className="h-4 w-4 shrink-0 text-danger" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  {entry.who}{" "}
                  <span className="text-ink-faint">· {entry.role}</span>
                </p>
                <p className="text-xs text-ink-muted">{entry.action}</p>
              </div>
              <span className="hidden font-mono text-[11px] text-ink-faint sm:block">
                {entry.hash}
              </span>
              <span className="w-36 shrink-0 text-right text-xs text-ink-faint">
                {entry.when}
              </span>
              <Badge tone={entry.outcome === "granted" ? "success" : "danger"}>
                {entry.outcome === "granted" ? "Granted" : "Denied"}
              </Badge>
            </li>
          ))}
        </ul>
      </Card>
    </AppShell>
  );
}
