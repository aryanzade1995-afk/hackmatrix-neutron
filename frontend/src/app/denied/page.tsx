import Link from "next/link";
import { Mark } from "@/components/Mark";
import { FigShield } from "@/components/Figures";
import { ArrowLeft, Link2, ShieldAlert } from "lucide-react";

const record = [
  { k: "Attempted", v: "Open patient record PT-2291" },
  { k: "Account", v: "K. Iyer · Administrator" },
  { k: "Refused by", v: "Server-side role check" },
  { k: "Logged at", v: "Today, 09:58 AM" },
];

export default function DeniedPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="mesh-bar">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark className="h-[22px] w-[22px] text-sage-light" />
            <span className="font-serif text-[17px] font-semibold tracking-tight text-cream">
              Hackmatrix
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col items-center px-8 py-16 text-center">
        <FigShield className="h-[190px] w-auto" />

        <p className="mt-9 text-[10.5px] font-semibold uppercase tracking-label text-ink-faint">
          Refused
        </p>
        <h1 className="text-display mt-3 text-[32px] text-ink">Access denied</h1>
        <p className="mt-4 max-w-md text-[14.5px] leading-relaxed text-ink-muted">
          This account does not hold clinician rights, so the record was never read from
          the database. The refusal happened on the server — there is no hidden button
          that would have shown it.
        </p>

        <div className="mt-9 w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface text-left shadow-card">
          <p className="flex items-center gap-2 border-b border-border bg-danger-tint px-6 py-3 text-[12.5px] font-semibold text-danger">
            <ShieldAlert className="h-4 w-4" />
            This attempt was recorded
          </p>
          <dl className="divide-y divide-border">
            {record.map((row) => (
              <div key={row.k} className="flex items-baseline gap-4 px-6 py-3">
                <dt className="w-24 shrink-0 text-[11.5px] text-ink-faint">{row.k}</dt>
                <dd className="text-[13px] text-ink">{row.v}</dd>
              </div>
            ))}
          </dl>
          <p className="nums flex items-center gap-1.5 border-t border-border px-6 py-3 font-mono text-[11px] text-ink-faint">
            <Link2 className="h-3 w-3" />
            b07c…12f9 · chained to the entry before it
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/admin"
            className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to the aggregate view
          </Link>
          <Link
            href="/clinician/audit"
            className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-[13.5px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
          >
            See the audit log
          </Link>
        </div>
      </main>
    </div>
  );
}
