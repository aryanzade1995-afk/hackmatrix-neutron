"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Who is signed in, according to the server.
 *
 * Follows the same shape as `useApiList` in adminData.ts — a `source`
 * discriminator rather than a boolean, because "still checking" and "checked,
 * nobody is signed in" have to be told apart. Conflating them would bounce
 * every visitor to the login page for a frame before their session resolves.
 *
 * Note what this hook is not: it is not the access control. The server decides
 * that, on every request, from a cookie this code cannot read. This only
 * decides what to render — and if it were wrong, or removed, the API would
 * still refuse.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export type Session = { username: string; role: "clinician" | "admin" };

export type SessionState = {
  data: Session | null;
  source: "loading" | "api" | "unavailable";
  error: string | null;
  reload: () => void;
};

export function useSession(): SessionState {
  const [data, setData] = useState<Session | null>(null);
  const [source, setSource] = useState<SessionState["source"]>(
    API ? "loading" : "unavailable",
  );
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!API) {
      setSource("unavailable");
      setError("NEXT_PUBLIC_API_URL is not set");
      return;
    }

    const controller = new AbortController();

    fetch(`${API}/auth/me`, {
      signal: controller.signal,
      cache: "no-store",
      // Without this the cookie is simply not attached and every request
      // looks anonymous, however valid the session is.
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 401) {
          // A definite answer, not a failure: nobody is signed in.
          setData(null);
          setSource("api");
          setError(null);
          return;
        }
        if (!res.ok) throw new Error(`/auth/me → ${res.status}`);
        setData((await res.json()) as Session);
        setSource("api");
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // The backend is unreachable. Distinct from "not signed in" — the
        // guard must not redirect on this, or a dropped connection would log
        // a clinician out mid-consultation.
        setSource("unavailable");
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => controller.abort();
  }, [nonce]);

  return { data, source, error, reload };
}

/** Ends the session server-side, then hands back control to the caller. */
export async function logout(): Promise<void> {
  if (!API) return;
  try {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    // Nothing useful to do: the cookie is HttpOnly, so the page cannot clear
    // it itself. Navigating to /login is still the right next step.
  }
}
