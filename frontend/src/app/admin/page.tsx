import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, PageTitle, SectionLabel } from "@/components/Card";
import { FigAdministrator } from "@/components/Figures";
import { adminTabs } from "@/lib/demo-data";
import { ArrowUpRight, EyeOff, Lock, MessageCircle, Sparkles } from "lucide-react";

const stats = [
  { label: "Cases, last 30 days", value: "1,284", delta: "+8.2%", up: true },
  { label: "Districts reporting", value: "6", delta: "all active", up: null },
  { label: "Conditions tracked", value: "5", delta: "no change", up: null },
  { label: "Groups suppressed", value: "12", delta: "+3", up: true },
];

const casesByCondition = [
  { label: "Dengue", value: 412 },
  { label: "Diabetes", value: 338 },
  { label: "Hypertension", value: 296 },
  { label: "Tuberculosis", value: 151 },
  { label: "Malaria", value: 87 },
];
const maxCases = Math.max(...casesByCondition.map((c) => c.value));

const trend = [24, 31, 28, 40, 52, 47, 61, 58, 70, 66, 74, 69];

function areaPaths(points: number[], w: number, h: number) {
  const max = Math.max(...points);
  const step = w / (points.length - 1);
  const coords = points.map((p, i) => [i * step, h - (p / max) * h] as const);
  const line = coords
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L${w},${h} L0,${h} Z`;
  return { line, area, coords };
}

export default function AdminPage() {
  const { line, area, coords } = areaPaths(trend, 900, 120);

  return (
    <AppShell role="admin" userName="K. Iyer" tabs={adminTabs}>
      <PageTitle
        eyebrow="Pune Division · last 30 days"
        title="Public health overview"
        subtitle="Combined case counts only. Individual records are not reachable from this view."
        action={
          <Badge tone="sage">
            <Lock className="h-3 w-3" />
            Aggregate database role
          </Badge>
        }
      />

      {/* Stat row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border bg-surface px-6 py-5 shadow-card"
          >
            <p className="text-[11.5px] text-ink-faint">{stat.label}</p>
            <p className="nums text-display mt-2 text-[32px] text-forest">
              {stat.value}
            </p>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              {stat.up && <ArrowUpRight className="h-3 w-3 text-sage" />}
              {stat.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Case trend"
              subtitle="Weekly reported cases across all conditions"
              action={<Badge tone="neutral">12 weeks</Badge>}
            />
            <div className="px-6 pb-5">
              <svg viewBox="0 0 900 130" className="h-36 w-full" role="img">
                <defs>
                  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-sage)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="var(--color-sage)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 30, 60, 90, 120].map((y) => (
                  <line
                    key={y}
                    x1="0"
                    y1={y}
                    x2="900"
                    y2={y}
                    stroke="var(--color-border)"
                    strokeWidth="1"
                  />
                ))}
                <path d={area} fill="url(#fade)" />
                <path
                  d={line}
                  fill="none"
                  stroke="var(--color-forest-mid)"
                  strokeWidth="2.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={coords[coords.length - 1][0]}
                  cy={coords[coords.length - 1][1]}
                  r="4.5"
                  fill="var(--color-forest)"
                  stroke="white"
                  strokeWidth="2"
                />
              </svg>
              <div className="mt-1 flex justify-between text-[11.5px] text-ink-faint">
                <span>12 weeks ago</span>
                <span>This week</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Cases by condition"
              subtitle="Combined across all reporting facilities"
            />
            <div className="space-y-3 px-7 pb-7">
              {casesByCondition.map((c, i) => (
                <div key={c.label} className="flex items-center gap-4">
                  <span className="w-28 shrink-0 text-[13px] text-ink-muted">
                    {c.label}
                  </span>
                  <div className="h-8 flex-1 overflow-hidden rounded-lg bg-canvas ring-1 ring-inset ring-border">
                    <div
                      className="flex h-8 items-center justify-end rounded-lg pr-3"
                      style={{
                        width: `${(c.value / maxCases) * 100}%`,
                        backgroundColor:
                          i === 0 ? "var(--color-forest)" : "var(--color-forest-mid)",
                        opacity: i === 0 ? 1 : 1 - i * 0.13,
                      }}
                    >
                      <span className="nums text-[11.5px] font-semibold text-cream">
                        {c.value}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="flex items-center gap-4 px-7 py-6">
              <FigAdministrator className="h-[68px] w-auto shrink-0" />
              <div className="min-w-0">
                <SectionLabel>You are signed in as</SectionLabel>
                <p className="text-display mt-2 text-[19px] text-ink">Administrator</p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                  Your database login has no grant on the identified tables. Not a
                  hidden screen — the rows are unreachable from this account.
                </p>
              </div>
            </div>
          </Card>

          <Card tone="forest">
            <div className="px-7 py-6">
              <div className="flex items-center gap-2">
                <EyeOff className="h-[15px] w-[15px] text-sage-light" />
                <SectionLabel tone="light">Privacy threshold active</SectionLabel>
              </div>
              <p className="text-display mt-4 text-[22px] text-cream">
                <span className="nums">12</span> groups hidden
                <br />
                this period
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-cream-muted">
                Any location–week–condition group with fewer than 5 cases is replaced
                before it reaches this dashboard&apos;s database role — not filtered on
                screen.
              </p>
              <div className="mt-5 rounded-xl bg-white/[0.07] px-4 py-3.5 ring-1 ring-inset ring-white/10">
                <p className="text-[12.5px] font-medium text-cream">
                  Rural PHC Baramati · Malaria · this week
                </p>
                <p className="mt-1.5 text-[11.5px] text-cream-muted">
                  suppressed — group size below threshold (n &lt; 5)
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              eyebrow={
                <Badge tone="sage">
                  <Sparkles className="h-3 w-3" />
                  AI assistant
                </Badge>
              }
              title="Ask about the data"
              subtitle="Answers come only from the aggregate table"
            />
            <div className="px-6 pb-5">
              <div className="rounded-xl bg-canvas px-3.5 py-3">
                <p className="text-[13px] text-ink-muted">
                  Why did respiratory cases spike in August?
                </p>
              </div>
              <p className="mt-3 font-serif text-[15px] leading-relaxed text-ink">
                Respiratory cases rose roughly 40% division-wide in August versus July,
                concentrated in Wagholi and Hadapsar — matching last year&apos;s seasonal
                pattern.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border px-3.5 py-2.5">
                <MessageCircle className="h-4 w-4 shrink-0 text-ink-faint" />
                <span className="text-[13px] text-ink-faint">Ask a question…</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Reporting facilities" />
            <ul className="divide-y divide-border border-t border-border">
              {[
                "PHC Wagholi",
                "District Hospital Pune",
                "Rural PHC Baramati",
                "Sub-Center Hadapsar",
              ].map((facility) => (
                <li
                  key={facility}
                  className="flex items-center justify-between px-6 py-3"
                >
                  <span className="text-[13.5px] text-ink">{facility}</span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    Reporting
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
