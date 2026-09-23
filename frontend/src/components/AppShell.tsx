"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { Avatar } from "./Avatar";
import { Mark } from "./Mark";
import { useStore } from "@/lib/store";
import { CloudOff, Check, Loader2, LogOut } from "lucide-react";
import { logout, useSession } from "@/lib/session";

export type ShellTab = {
  label: string;
  href: string;
};

/**
 * Unsent writes, surfaced where a clinician will actually see them.
 *
 * Silence is the normal state: nothing renders when the queue is empty and
 * nothing has just drained, so the header stays quiet in the common case.
 */
function SyncStatus() {
  const { pendingCount, justSynced } = useStore();

  if (pendingCount > 0) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(212,160,60,0.2)] px-3 py-1 text-[11.5px] font-medium text-warning-lift ring-1 ring-inset ring-[rgba(239,201,138,0.3)]"
        title="Saved on this device. They will be sent when the connection returns."
      >
        <CloudOff className="h-3 w-3" />
        {pendingCount} waiting to sync
      </span>
    );
  }

  if (justSynced) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.08] px-3 py-1 text-[11.5px] font-medium text-success-lift ring-1 ring-inset ring-white/10">
        <Check className="h-3 w-3" />
        All changes synced
      </span>
    );
  }

  return null;
}

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
  const router = useRouter();
  const session = useSession();

  /**
   * Send anyone without the right session back to the login page.
   *
   * This is a rendering decision, not the access control — the API refuses
   * these requests regardless, from a cookie this code cannot read. Without
   * it, a clinician who wandered into /admin would see the dashboard frame
   * and a page full of 403s, which reads as a broken app rather than a
   * boundary doing its job.
   *
   * Nothing happens while `source` is "loading" (the answer has not arrived)
   * or "unavailable" (the backend is unreachable). Redirecting on the latter
   * would log a clinician out because their wifi dropped.
   */
  useEffect(() => {
    if (session.source !== "api") return;
    if (session.data === null || session.data.role !== role) {
      router.replace("/login");
    }
  }, [session.source, session.data, role, router]);

  async function signOut() {
    await logout();
    router.replace("/login");
  }

  // Hold the frame back until the session is known, so a protected page never
  // paints for someone who is about to be redirected away from it.
  if (session.source === "api" && (session.data === null || session.data.role !== role)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="flex items-center gap-2 text-[13px] text-ink-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Redirecting to sign in…
        </p>
      </div>
    );
  }

  // The signed-in name from the server, falling back to the prop while the
  // session resolves so the header does not flicker empty.
  const displayName = session.data?.username ?? userName;

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
            <SyncStatus />
            <span className="hidden text-[11px] font-medium uppercase tracking-label text-sage-light sm:block">
              {role === "clinician" ? "Clinician access" : "Aggregate access"}
            </span>
            <span className="h-5 w-px bg-white/15" />
            <div className="flex items-center gap-2.5">
              <Avatar name={displayName} size="sm" tone="cream" />
              <span className="hidden text-[13px] text-cream sm:block">
                {displayName}
              </span>
            </div>
            <button
              type="button"
              onClick={signOut}
              title="Sign out"
              className="transition-calm inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-cream-muted hover:bg-white/[0.08] hover:text-cream"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:block">Log out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-8 py-7">{children}</main>
    </div>
  );
}
