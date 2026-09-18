import Link from "next/link";
import { Mark } from "@/components/Mark";
import { FigClinician } from "@/components/Figures";
import { ArrowRight, Lock } from "lucide-react";

const roles = [
  { href: "/clinician", label: "Clinician", hint: "opens one patient in full" },
  { href: "/admin", label: "Administrator", hint: "sees counts, never names" },
];

export default function LoginPage() {
  return (
    <div className="mesh-deep flex min-h-screen flex-1 flex-col">
      <header className="mx-auto w-full max-w-[1400px] px-8 py-7">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <Mark className="h-[22px] w-[22px] text-sage-light" />
          <span className="font-serif text-[17px] font-semibold tracking-tight text-cream">
            Hackmatrix
          </span>
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[1000px] flex-1 items-center px-8 pb-20">
        <div className="grid w-full grid-cols-1 items-center gap-12 md:grid-cols-[minmax(0,1fr)_200px]">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-label text-sage-light">
              Staff sign in
            </p>
            <h1 className="text-display mt-3 text-[34px] text-cream">
              Your role decides
              <br />
              what you can open.
            </h1>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-cream-muted">
              Rights are checked on the server every time a record is requested — not
              hidden in the interface.
            </p>

            <div className="mt-8 max-w-md space-y-2.5">
              <label className="block">
                <span className="sr-only">Username</span>
                <input
                  type="text"
                  placeholder="username"
                  className="transition-calm w-full rounded-xl bg-white/[0.06] px-4 py-3 text-[13.5px] text-cream ring-1 ring-inset ring-white/10 placeholder:text-cream-muted focus:bg-white/[0.09] focus:outline-none focus:ring-white/25"
                />
              </label>
              <label className="block">
                <span className="sr-only">Password</span>
                <input
                  type="password"
                  placeholder="password"
                  className="transition-calm w-full rounded-xl bg-white/[0.06] px-4 py-3 text-[13.5px] text-cream ring-1 ring-inset ring-white/10 placeholder:text-cream-muted focus:bg-white/[0.09] focus:outline-none focus:ring-white/25"
                />
              </label>
            </div>

            <p className="mt-7 text-[11px] font-semibold uppercase tracking-label text-sage-light">
              Demo — continue as
            </p>
            <div className="mt-3 flex max-w-md flex-col gap-2.5 sm:flex-row">
              {roles.map((role) => (
                <Link
                  key={role.href}
                  href={role.href}
                  className="transition-calm group flex-1 rounded-xl bg-cream px-4 py-3 text-forest-deep hover:bg-white"
                >
                  <span className="flex items-center justify-between text-[13.5px] font-semibold">
                    {role.label}
                    <ArrowRight className="transition-calm h-4 w-4 group-hover:translate-x-0.5" />
                  </span>
                  <span className="mt-0.5 block text-[11.5px] text-ink-muted">
                    {role.hint}
                  </span>
                </Link>
              ))}
            </div>

            <p className="mt-6 flex items-center gap-2 text-[11.5px] text-cream-muted">
              <Lock className="h-3.5 w-3.5" />
              Synthetic data only — no real patient records exist in this build
            </p>
          </div>

          <FigClinician className="mx-auto hidden h-auto w-[180px] md:block" />
        </div>
      </main>
    </div>
  );
}
