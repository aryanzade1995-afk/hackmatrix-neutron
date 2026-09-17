"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";
import { Mark } from "./Mark";

export type ShellTab = {
  label: string;
  href: string;
};

export function AppShell({
  role,
  userName,
  tabs,
  children,
}: {
  role: "clinician" | "admin";
  userName: string;
  tabs: ShellTab[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mesh-bar">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-8">
          <div className="flex items-center gap-10">
            <Link href="/" className="flex items-center gap-2.5">
              <Mark className="h-[22px] w-[22px] text-sage-light" />
              <span className="font-serif text-[17px] font-semibold tracking-tight text-cream">
                Hackmatrix
              </span>
            </Link>

            <nav className="flex items-center gap-1">
              {tabs.map((tab) => {
                const active = pathname === tab.href;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`transition-calm rounded-lg px-3.5 py-1.5 text-[13.5px] font-medium ${
                      active
                        ? "bg-white/10 text-cream shadow-inset"
                        : "text-cream-muted hover:bg-white/[0.06] hover:text-cream"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-[11px] font-medium uppercase tracking-label text-sage-light sm:block">
              {role === "clinician" ? "Clinician access" : "Aggregate access"}
            </span>
            <span className="h-5 w-px bg-white/15" />
            <div className="flex items-center gap-2.5">
              <Avatar name={userName} size="sm" tone="cream" />
              <span className="hidden text-[13px] text-cream sm:block">{userName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-7">{children}</main>
    </div>
  );
}
