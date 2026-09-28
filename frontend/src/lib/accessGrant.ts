"use client";

import { useEffect, useState } from "react";

/**
 * How a record was opened, and when.
 *
 * The scan screen promises that "access lasts five minutes and is written to
 * the audit log". A grant is that promise made concrete on this device: it is
 * created at the moment of access — a QR scan, a search from Find patient, or
 * break-glass — and records whether the audit write succeeded. The record page
 * reads it to show which of those happened and a real countdown, instead of a
 * fixed "Verified via QR consent token · expires in 4:12" on every record.
 *
 * It is a display of what happened, not the access control: the server
 * decides what a session may read on every request.
 */

export const GRANT_MS = 5 * 60 * 1000;

export type GrantVia = "qr" | "search" | "emergency";

export type AccessGrant = {
  patientId: string;
  via: GrantVia;
  /** Epoch milliseconds. */
  at: number;
  /** What happened to the access-log entry for this access. */
  audit: "logged" | "queued" | "failed";
};

const KEY = "hackmatrix.accessGrants.v1";

function readAll(): Record<string, AccessGrant> {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, AccessGrant>) : {};
  } catch {
    return {};
  }
}

export function recordGrant(grant: AccessGrant): void {
  try {
    window.sessionStorage.setItem(
      KEY,
      JSON.stringify({ ...readAll(), [grant.patientId.toUpperCase()]: grant }),
    );
  } catch {
    /* storage unavailable: the record still opens, without the countdown */
  }
}

export function readGrant(patientId: string): AccessGrant | null {
  if (typeof window === "undefined") return null;
  return readAll()[patientId.toUpperCase()] ?? null;
}

export function remainingMs(grant: AccessGrant, now: number): number {
  return Math.max(0, grant.at + GRANT_MS - now);
}

/**
 * The grant for a patient and the time left on it, ticking once a second.
 * Read after mount, so the server render and the first client render agree.
 */
export function useAccessGrant(patientId: string): {
  grant: AccessGrant | null;
  remaining: number;
  ready: boolean;
} {
  const [grant, setGrant] = useState<AccessGrant | null>(null);
  const [now, setNow] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setGrant(readGrant(patientId));
    setNow(Date.now());
    setReady(true);
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [patientId]);

  return { grant, remaining: grant ? remainingMs(grant, now) : 0, ready };
}
