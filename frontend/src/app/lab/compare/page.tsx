import { Mark } from "@/components/Mark";
import { ArtConsult, ArtRefused } from "@/components/Illustrations";
import { FigClinician, FigShield } from "@/components/Figures";
import { ShieldAlert } from "lucide-react";

/* Two unbuilt screens, mocked twice each — once with the line-art set, once
   with the character set — so the direction can be judged in context rather
   than as loose artwork. */

function LoginMock({ art }: { art: React.ReactNode }) {
  return (
    <div className="mesh-deep overflow-hidden rounded-2xl shadow-deep">
      <div className="flex items-center gap-8 px-9 py-10">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <Mark className="h-[18px] w-[18px] text-sage-light" />
            <span className="font-serif text-[14px] font-semibold text-cream">
              Hackmatrix
            </span>
          </div>
          <h3 className="text-display mt-7 text-[24px] text-cream">Sign in</h3>
          <p className="mt-2 text-[12.5px] leading-relaxed text-cream-muted">
            Your role decides what you can open.
          </p>

          <div className="mt-6 space-y-2.5">
            <div className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-[12.5px] text-cream-muted ring-1 ring-inset ring-white/10">
              username
            </div>
            <div className="rounded-xl bg-white/[0.06] px-4 py-2.5 text-[12.5px] text-cream-muted ring-1 ring-inset ring-white/10">
              ••••••••
            </div>
          </div>
          <div className="mt-4 rounded-xl bg-cream px-4 py-2.5 text-center text-[12.5px] font-semibold text-forest-deep">
            Continue
          </div>
        </div>

        <div className="hidden w-[150px] shrink-0 sm:block">{art}</div>
      </div>
    </div>
  );
}

function DeniedMock({ art }: { art: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div className="flex flex-col items-center px-9 py-10 text-center">
        <div className="h-[130px]">{art}</div>
        <h3 className="text-display mt-6 text-[22px] text-ink">Access denied</h3>
        <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-ink-muted">
          This account does not hold clinician rights, so the record was never loaded —
          the refusal happened on the server, not in the interface.
        </p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-danger-tint px-3.5 py-1.5 text-[12px] font-medium text-danger">
          <ShieldAlert className="h-3.5 w-3.5" />
          Attempt recorded in the audit log
        </span>
      </div>
    </div>
  );
}

function Column({
  label,
  note,
  children,
}: {
  label: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-label text-sage">
        {label}
      </p>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">{note}</p>
      <div className="mt-5 space-y-7">{children}</div>
    </div>
  );
}

export default function CompareLab() {
  return (
    <div className="mx-auto max-w-[1240px] px-9 py-12">
      <p className="text-[10.5px] font-semibold uppercase tracking-label text-ink-faint">
        Internal · not part of the product
      </p>
      <h1 className="text-display mt-2 text-[30px] text-ink">
        Line art or characters
      </h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-muted">
        The same two screens — sign in, and access denied — built twice. Judge the
        direction in context, then I&apos;ll take the whole product one way.
      </p>

      <div className="mt-11 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <Column
          label="Option 1 · Line art"
          note="Quieter and more distinctive. Sits closest to your serif typography and reads as a considered system rather than as illustration."
        >
          <LoginMock art={<ArtConsult className="h-auto w-full text-sage-light" />} />
          <DeniedMock art={<ArtRefused className="h-full w-auto text-forest" />} />
        </Column>

        <Column
          label="Option 2 · Characters"
          note="Warmer and more approachable, closer to the references you sent. Carries more visual weight, so it needs more room to breathe."
        >
          <LoginMock art={<FigClinician className="h-auto w-full" />} />
          <DeniedMock art={<FigShield className="h-full w-auto" />} />
        </Column>
      </div>
    </div>
  );
}
