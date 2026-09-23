"use client";

import { useCallback, useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export type AccessLogEntry = {
  id: number;
  patientId: string | null;
  actor: string;
  action: "view_record" | "emergency_access";
  outcome: "granted" | "denied";
  reason: string | null;
  prevHash: string;
  hash: string;
  createdAt: string;
};

export type VerifyResult = {
  valid: boolean;
  rowsChecked: number;
  brokenAtId?: number;
  detail?: string;
};

/**
 * Records an access attempt.
 *
 * Fire-and-forget by design: the clinician's navigation must not wait on the
 * log, and a logging failure must never be the reason a doctor cannot open a
 * record. The write is still append-only at the database, so a lost entry is
 * a gap, never a rewrite.
 */
export async function recordAccess(entry: {
  patientId?: string | null;
  actor: string;
  action: AccessLogEntry["action"];
  outcome?: AccessLogEntry["outcome"];
  reason?: string;
}): Promise<AccessLogEntry | null> {
  if (!API) return null;
  try {
    const res = await fetch(`${API}/clinician/access-log`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome: "granted", ...entry }),
    });
    if (!res.ok) return null;
    return (await res.json()) as AccessLogEntry;
  } catch {
    return null;
  }
}

export function useAccessLog(patientId?: string) {
  const [entries, setEntries] = useState<AccessLogEntry[]>([]);
  const [source, setSource] = useState<"loading" | "api" | "unavailable">(
    API ? "loading" : "unavailable",
  );
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!API) {
      setSource("unavailable");
      setError("NEXT_PUBLIC_API_URL is not set");
      return;
    }
    try {
      const qs = patientId ? `?patient_id=${encodeURIComponent(patientId)}` : "";
      const res = await fetch(`${API}/clinician/access-log${qs}`, { cache: "no-store", credentials: "include" });
      if (!res.ok) throw new Error(`access-log → ${res.status}`);
      setEntries((await res.json()) as AccessLogEntry[]);
      setSource("api");
      setError(null);
    } catch (err) {
      setSource("unavailable");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { entries, source, error, reload: load };
}

export async function verifyChain(): Promise<VerifyResult | null> {
  if (!API) return null;
  try {
    const res = await fetch(`${API}/clinician/access-log/verify`, { cache: "no-store", credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as VerifyResult;
  } catch {
    return null;
  }
}
