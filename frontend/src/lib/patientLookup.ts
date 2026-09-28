"use client";

import { useEffect, useState } from "react";
import { findPatientById } from "./clinical";
import type { Patient } from "./demo-data";
import { useStore } from "./store";

/**
 * Resolving a patient id — from a scanned QR, or from ?patient= in a URL.
 *
 * The one rule: an id that does not resolve never turns into somebody else's
 * record. Earlier every record screen fell back to a default patient when the
 * id was unknown, so a mistyped link, a code from another system, or a
 * patient not yet in the local list opened Priya Nair's chart, and a visit
 * saved there was written to her.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export type ServerLookup =
  | { kind: "found"; patient: Patient }
  | { kind: "missing" }
  | { kind: "unauthorized" }
  | { kind: "forbidden" }
  | { kind: "offline" }
  | { kind: "error"; message: string };

/** Asks the server for one patient. Matches case-insensitively there. */
export async function fetchPatient(id: string): Promise<ServerLookup> {
  if (!API) return { kind: "offline" };
  try {
    const res = await fetch(`${API}/clinician/patients/${encodeURIComponent(id.trim())}`, {
      cache: "no-store",
      credentials: "include",
    });
    if (res.status === 404) return { kind: "missing" };
    if (res.status === 401) return { kind: "unauthorized" };
    if (res.status === 403) return { kind: "forbidden" };
    if (!res.ok) return { kind: "error", message: `The records server answered ${res.status}.` };
    const p = (await res.json()) as Patient & { phone?: string | null };
    return { kind: "found", patient: { ...p, phone: p.phone ?? undefined } };
  } catch (err) {
    if (err instanceof TypeError) return { kind: "offline" };
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

export type PatientLookup =
  | { status: "none" }
  | { status: "loading"; id: string }
  | { status: "found"; patient: Patient }
  | { status: "missing"; id: string; offline: boolean };

/**
 * The patient named by `id`. Looks in the store first; while the store is
 * still loading the answer is "loading", not a guess; and when the store is
 * loaded but does not hold the id, the server is asked before concluding the
 * patient does not exist.
 */
export function usePatientLookup(id: string | null): PatientLookup {
  const { patients, source, rememberPatient } = useStore();
  const [server, setServer] = useState<{ id: string; result: ServerLookup } | null>(null);

  const wanted = id?.trim() || null;
  const local = wanted ? findPatientById(patients, wanted) : undefined;
  const needServer = Boolean(wanted && !local && source === "api");

  useEffect(() => {
    if (!needServer || !wanted) return;
    if (server?.id === wanted) return;
    let cancelled = false;
    void fetchPatient(wanted).then((result) => {
      if (cancelled) return;
      if (result.kind === "found") rememberPatient(result.patient);
      setServer({ id: wanted, result });
    });
    return () => {
      cancelled = true;
    };
  }, [needServer, wanted, server?.id, rememberPatient]);

  if (!wanted) return { status: "none" };
  if (local) return { status: "found", patient: local };
  if (source === "loading") return { status: "loading", id: wanted };
  if (source === "seed") return { status: "missing", id: wanted, offline: true };
  if (server?.id !== wanted) return { status: "loading", id: wanted };
  if (server.result.kind === "found") return { status: "found", patient: server.result.patient };
  return {
    status: "missing",
    id: wanted,
    offline: server.result.kind === "offline",
  };
}
