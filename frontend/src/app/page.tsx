import Link from "next/link";
import { ArrowRight, BarChart3, Stethoscope } from "lucide-react";
import { Mark } from "@/components/Mark";
import { FigTwoReadings } from "@/components/Figures";
import { PopulationGrid } from "@/components/PopulationGrid";
import { ConsentTokenCard } from "@/components/LightPreviews";

const roles = [
  {
    href: "/clinician",
    icon: Stethoscope,
    label: "Clinician",
    title: "One patient, in full",
    body: "Scan a consent QR to open a patient's complete visit and prescription history, with an AI summary that cites every claim.",
  },
  {
    href: "/admin",
    icon: BarChart3,
    label: "Administrator",
    title: "Everyone, anonymously",
    body: "Track case patterns across districts and conditions. Groups too small to be anonymous are removed before you ever see them.",
  },
];

export default function Home({
  searchParams,
}: {
  searchParams?: { grain?: string };
}) {
  // Compare the two at full size: "/" vs "/?grain=1"
  const grain = searchParams?.grain === "1";

  return (
    <div
      className={`mesh-deep flex min-h-screen flex-1 flex-col ${grain ? "grain" : ""}`}
    >
      <header className="mx-auto w-full max-w-[1400px] px-8 py-7">
        <div className="flex items-center gap-2.5">
          <Mark className="h-[22px] w-[22px] text-sage-light" />
          <span className="font-serif text-[17px] font-semibold tracking-tight text-cream">
            Hackmatrix
          </span>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col px-8 pb-24 pt-10">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
          <div className="max-w-xl">
            <p className="text-[11px] font-semibold uppercase tracking-label text-sage-light">
              Unified health records
            </p>
            <h1 className="text-display mt-4 text-[clamp(2.25rem,5vw,3.5rem)] text-cream">
              One record.
              <br />
              Two safe ways in.
            </h1>
            <p className="mt-5 max-w-lg text-[15.5px] leading-relaxed text-cream-muted">
              A doctor needs everything about one person. A health officer needs patterns
              across thousands, and nothing about anyone. The separation is enforced by
              the database itself — not hidden by the interface.
            </p>
          </div>

          <div className="hidden lg:block">
            <FigTwoReadings className="ml-auto h-auto w-full max-w-[520px]" />
            <p className="mt-5 text-right text-[12px] text-cream-muted">
              Split enforced by Postgres <span className="font-mono">GRANT</span> /{" "}
              <span className="font-mono">REVOKE</span> — not by the interface
            </p>
          </div>
        </div>

        {/* One dot per person — one of them lit */}
        <PopulationGrid className="mt-20" />

        {/* What unlocks a record in the first place */}
        <ConsentTokenCard className="mt-20" />

        <div className="mt-20 grid grid-cols-1 gap-6 md:grid-cols-2">
          {roles.map((role) => (
            <Link
              key={role.href}
              href={role.href}
              className="transition-calm group rounded-2xl bg-white/[0.04] p-7 ring-1 ring-inset ring-white/10 hover:bg-white/[0.07] hover:ring-white/20"
            >
              <div className="flex items-center gap-2.5">
                <role.icon className="h-[18px] w-[18px] text-sage-light" />
                <span className="text-[11px] font-semibold uppercase tracking-label text-sage-light">
                  {role.label}
                </span>
              </div>
              <h2 className="mt-4 font-serif text-[22px] font-semibold leading-snug text-cream">
                {role.title}
              </h2>
              <p className="mt-2.5 text-[14px] leading-relaxed text-cream-muted">
                {role.body}
              </p>
              <span className="transition-calm mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-cream group-hover:gap-2.5">
                Open view
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </main>

      <footer className="mx-auto w-full max-w-[1400px] px-8 pb-8">
        <p className="border-t border-white/10 pt-6 text-[12px] text-cream-muted">
          Demonstration build · all patient data shown is synthetic
        </p>
      </footer>
    </div>
  );
}
