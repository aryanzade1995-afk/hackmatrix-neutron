"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/Mark";
import { FigClinician } from "@/components/Figures";
import { Loader2, Lock, TriangleAlert } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Staff sign in.
 *
 * This page used to carry two "continue as" links straight into the clinician
 * and administrator areas, with the username and password fields wired to
 * nothing. The role a visitor got was whichever link they clicked.
 *
 * Now the server decides. The credentials are checked against a bcrypt hash in
 * the `staff` table, and the role comes back from the session rather than from
 * the caller's choice — so there is no longer any way to ask for a role, only
 * to prove one.
 */
export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password) {
      setError("Enter both a username and a password");
      return;
    }
    if (!API) {
      setError("NEXT_PUBLIC_API_URL is not set, so there is no server to ask.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The session arrives as an HttpOnly cookie; without this it is
        // dropped and the user lands back here.
        credentials: "include",
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.detail === "string"
            ? body.detail
            : "Invalid username or password",
        );
        return;
      }

      const { role } = (await res.json()) as { role: "clinician" | "admin" };
      // The destination comes from the server's answer, not from anything
      // typed into this page.
      router.push(role === "admin" ? "/admin" : "/clinician");
    } catch {
      setError("Could not reach the server. Check that the API is running.");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "transition-calm w-full rounded-xl bg-white/[0.06] px-4 py-3 text-[13.5px] text-cream ring-1 ring-inset ring-white/10 placeholder:text-cream-muted focus:bg-white/[0.09] focus:outline-none focus:ring-white/25";

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

            <form onSubmit={handleSubmit} className="mt-8 max-w-md space-y-2.5">
              <label className="block">
                <span className="sr-only">Username</span>
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  autoCapitalize="none"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={busy}
                  className={field}
                />
              </label>
              <label className="block">
                <span className="sr-only">Password</span>
                <input
                  type="password"
                  name="password"
                  autoComplete="current-password"
                  placeholder="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  className={field}
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="flex items-start gap-2 pt-1 text-[12.5px] leading-relaxed text-[#F5928A]"
                >
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="transition-calm mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cream px-4 py-3 text-[13.5px] font-semibold text-forest-deep hover:bg-white disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </form>

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
