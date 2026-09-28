"use client";

import { useCallback, useEffect, useState } from "react";
import { enqueue, isConnectivityFailure } from "./writeQueue";

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

export type AccessResult =
  | { status: "logged"; entry: AccessLogEntry }
  /** No connection: kept on this device and sent with the next sync. */
  | { status: "queued" }
  /** The server answered and refused. Nothing was recorded. */
  | { status: "rejected"; message: string };

/**
 * Records an access attempt, and says whether it was recorded.
 *
 * Who accessed the record is not sent: the server takes it from the signed
 * session, so the trail names whoever is actually signed in. When the server
 * cannot be reached the entry is queued rather than lost — the log is
 * append-only, so a late entry is a delay, never a rewrite — and the reason
 * notes when the access really happened, since the server stamps its own time
 * on arrival.
 */
export async function recordAccess(entry: {
  patientId?: string | null;
  action: AccessLogEntry["action"];
  outcome?: AccessLogEntry["outcome"];
  reason?: string;
}): Promise<AccessResult> {
  const body = { outcome: "granted" as const, ...entry, patientId: entry.patientId ?? null };
  if (!API) return { status: "rejected", message: "NEXT_PUBLIC_API_URL is not set" };
  try {
    const res = await fetch(`${API}/clinician/access-log`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return { status: "logged", entry: (await res.json()) as AccessLogEntry };
    const detail = (await res.json().catch(() => null)) as { detail?: unknown } | null;
    return {
      status: "rejected",
      message:
        typeof detail?.detail === "string"
          ? detail.detail
          : `The audit log refused the entry (${res.status}).`,
    };
  } catch (err) {
    if (!isConnectivityFailure(err)) {
      return { status: "rejected", message: err instanceof Error ? err.message : String(err) };
    }
    const at = new Date().toISOString();
    enqueue({
      kind: "access",
      payload: {
        id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        patientId: body.patientId,
        action: body.action,
        outcome: body.outcome,
        reason: [body.reason, `recorded offline at ${at}`].filter(Boolean).join(" — "),
      },
      queuedAt: at,
    });
    return { status: "queued" };
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
