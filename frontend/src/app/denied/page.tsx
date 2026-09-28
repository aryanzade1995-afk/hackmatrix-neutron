import Link from "next/link";
import { Mark } from "@/components/Mark";
import { FigShield } from "@/components/Figures";
import { ArrowLeft, LogIn } from "lucide-react";

/**
 * Where a patient lookup lands when the server answers 403: signed in, but
 * not with clinician rights.
 *
 * This page used to show an "attempt was recorded" card with a fixed patient,
 * account, time and hash that matched no row in the audit log. It shows only
 * what is true: the server refused, and no record was read. A session without
 * clinician rights cannot write to the access log either, so this page does
 * not claim that it did.
 */

export default function DeniedPage() {
  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="mesh-bar">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <Mark className="h-[22px] w-[22px] text-sage-light" />
            <span className="font-serif text-[17px] font-semibold tracking-tight text-cream">
              SwasthyaLink
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

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep"
          >
            <LogIn className="h-4 w-4" />
            Sign in as a clinician
          </Link>
          <Link
            href="/admin"
            className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-[13.5px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to the aggregate view
          </Link>
        </div>
      </main>
    </div>
  );
}
