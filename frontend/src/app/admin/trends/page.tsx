import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle } from "@/components/Card";
import { adminTabs, conditionsByDistrict } from "@/lib/demo-data";
import { EyeOff } from "lucide-react";

const COLUMNS = [
  { key: "dengue", label: "Dengue" },
  { key: "diabetes", label: "Diabetes" },
  { key: "hypertension", label: "Hypertension" },
  { key: "tb", label: "TB" },
  { key: "malaria", label: "Malaria" },
] as const;

export default function AdminTrendsPage() {
  return (
    <AppShell role="admin" userName="K. Iyer" tabs={adminTabs}>
      <PageTitle
        eyebrow="Pune Division"
        title="Trends by district"
        subtitle="Case counts only. Individual records are not reachable from this view."
        action={<Badge tone="sage">Last 30 days</Badge>}
      />

      <Card className="overflow-hidden">
        <CardHeader
          title="Cases by district and condition"
          subtitle="Counts below the privacy threshold are replaced before they reach this table"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-2.5 text-xs font-medium text-ink-muted">District</th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className="px-5 py-2.5 text-right text-xs font-medium text-ink-muted"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {conditionsByDistrict.map((row) => (
                <tr key={row.district}>
                  <td className="px-5 py-3 text-ink">{row.district}</td>
                  {COLUMNS.map((col) => (
                    <td
                      key={col.key}
                      className="nums px-5 py-3 text-right text-ink-muted"
                    >
                      {row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="bg-warning-tint/50">
                <td className="px-5 py-3 text-ink">Sub-Center Khed</td>
                {COLUMNS.map((col) => (
                  <td key={col.key} className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-1 text-xs text-warning">
                      <EyeOff className="h-3 w-3" />
                      hidden
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-t border-border px-5 py-3 text-xs text-ink-muted">
          Sub-Center Khed reported fewer than 5 cases in every category this period, so
          its counts are suppressed rather than shown.
        </div>
      </Card>
    </AppShell>
  );
}
