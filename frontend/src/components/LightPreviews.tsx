import { QrCode, ShieldCheck } from "lucide-react";

/**
 * The QR consent moment, as a full-width light band. Sits between the
 * population grid and the role cards so all three share the same edges.
 */
export function ConsentTokenCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl bg-cream px-8 py-7 shadow-deep ${className}`}>
      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-6">
          <div className="grid shrink-0 place-items-center rounded-xl bg-forest-deep p-4">
            <QrCode className="h-12 w-12 text-cream" strokeWidth={1.25} />
          </div>
          <div className="min-w-0">
            <p className="text-display text-[19px] text-ink">Consent token</p>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-muted">
              Every record opens behind a signed, single-use token that expires in five
              minutes — modelled on the way India&apos;s ABHA consent tokens work.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 rounded-xl bg-success-tint px-4 py-2.5 text-[12.5px] font-medium text-success">
          <ShieldCheck className="h-4 w-4" />
          checked server-side at scan time
        </div>
      </div>
    </div>
  );
}
