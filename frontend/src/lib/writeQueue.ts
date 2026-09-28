"use client";

import type { Patient, Visit } from "./demo-data";

/**
 * A durable queue for writes that could not reach the server.
 *
 * Rural PHC connectivity is unreliable, which is the actual deployment
 * context — a consultation should not be lost because the link dropped while
 * the doctor was typing. Failed writes are persisted to localStorage and
 * replayed later rather than surfaced as an error the clinician has to
 * remember to act on.
 *
 * Replay is safe because ids are generated client-side. For a patient, the
 * backend returns the existing row (200) when the same registration arrives
 * twice, and 409 only when the id belongs to somebody else. That 409 is a real
 * collision — an offline registration picked a number another clinician took
 * first — so the patient is registered again without an id, the server's new
 * id replaces the provisional one, and the change is recorded so the patient
 * can be given a corrected QR. Visits that were queued for the provisional id
 * are sent under the new one.
 */

const KEY = "hackmatrix.writeQueue.v1";
const REASSIGNED_KEY = "hackmatrix.reassignedIds.v1";
const HIGH_WATER_KEY = "hackmatrix.patientHighWater.v1";

/** Highest PT number this device has seen, so ids it proposes never repeat. */
export function readHighWater(): number {
  if (!canPersist()) return 0;
  try {
    return Number(window.localStorage.getItem(HIGH_WATER_KEY)) || 0;
  } catch {
    return 0;
  }
}

function ptNumber(id: string): number {
  const m = /^PT-(\d+)$/i.exec(id);
  return m ? Number(m[1]) : 0;
}

export function raiseHighWater(ids: string[]): void {
  if (!canPersist()) return;
  const top = ids.reduce((max, id) => Math.max(max, ptNumber(id)), readHighWater());
  try {
    window.localStorage.setItem(HIGH_WATER_KEY, String(top));
  } catch {
    /* storage unavailable */
  }
}

/** A provisional patient id that had to change when it reached the server. */
export type Reassignment = { from: string; to: string; name: string; at: string };

export function readReassignments(): Reassignment[] {
  if (!canPersist()) return [];
  try {
    const raw = window.localStorage.getItem(REASSIGNED_KEY);
    return raw ? (JSON.parse(raw) as Reassignment[]) : [];
  } catch {
    return [];
  }
}

export function dismissReassignment(from: string): Reassignment[] {
  const next = readReassignments().filter((r) => r.from !== from);
  if (canPersist()) {
    try {
      window.localStorage.setItem(REASSIGNED_KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable */
    }
  }
  return next;
}

function recordReassignment(r: Reassignment): void {
  if (!canPersist()) return;
  try {
    window.localStorage.setItem(
      REASSIGNED_KEY,
      JSON.stringify([...readReassignments().filter((x) => x.from !== r.from), r]),
    );
  } catch {
    /* storage unavailable: the store still reports it for this session */
  }
}

/** An access-log entry that could not be written when the access happened. */
export type AccessPayload = {
  /** Local identity for the queue only; the server assigns the row id. */
  id: string;
  patientId: string | null;
  action: "view_record" | "emergency_access";
  outcome: "granted" | "denied";
  reason?: string;
};

export type QueuedWrite =
  | { kind: "patient"; payload: Patient; queuedAt: string }
  | { kind: "visit"; payload: Visit; queuedAt: string }
  | { kind: "access"; payload: AccessPayload; queuedAt: string };

/** Fired whenever the queue changes, so the sync indicator can follow it. */
export const QUEUE_EVENT = "hackmatrix:queue-changed";

function canPersist(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

export function readQueue(): QueuedWrite[] {
  if (!canPersist()) return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch {
    // Corrupt or unreadable storage should not break the app; start clean.
    return [];
  }
}

function writeQueue(items: QueuedWrite[]): void {
  if (!canPersist()) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Quota exceeded or storage disabled. The in-memory copy still holds, so
    // the current session is fine; only replay across a reload is lost.
  }
}

export function enqueue(item: QueuedWrite): QueuedWrite[] {
  const next = [...readQueue(), item];
  writeQueue(next);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(QUEUE_EVENT));
  return next;
}

/**
 * Distinguishes "the server answered and refused" from "the server was not
 * reachable". Only the second is worth retrying — a 422 will be a 422 forever,
 * and queueing it would retry a bad payload indefinitely.
 */
export function isConnectivityFailure(err: unknown): boolean {
  return err instanceof TypeError; // fetch throws TypeError on network failure
}

export type FlushResult = {
  sent: number;
  remaining: number;
  /** True when the queue stopped early because the network is still down. */
  stalled: boolean;
  /** Provisional patient ids replaced by server-assigned ones on this flush. */
  reassigned: Reassignment[];
};

async function post(api: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${api}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Same queued item: kind, payload id and the moment it was queued. */
function sameItem(a: QueuedWrite, b: QueuedWrite): boolean {
  return a.kind === b.kind && a.payload.id === b.payload.id && a.queuedAt === b.queuedAt;
}

/** Removes one item by identity, re-reading storage so concurrent adds survive. */
function removeItem(item: QueuedWrite): void {
  writeQueue(readQueue().filter((q) => !sameItem(q, item)));
}

/** Rewrites queued visits of a provisional patient id to its new id. */
function remapVisits(from: string, to: string): void {
  writeQueue(
    readQueue().map((q) =>
      q.kind === "visit" && q.payload.patientId === from
        ? { ...q, payload: { ...q.payload, patientId: to } }
        : q,
    ),
  );
}

let flushing: Promise<FlushResult> | null = null;

/**
 * Sends everything queued, in order. Only one flush runs at a time; a second
 * call while one is in flight waits for it instead of sending duplicates.
 */
export function flushQueue(api: string): Promise<FlushResult> {
  if (!flushing) {
    flushing = runFlush(api).finally(() => {
      flushing = null;
    });
  }
  return flushing;
}

async function runFlush(api: string): Promise<FlushResult> {
  const queue = readQueue();
  if (queue.length === 0 || !api) {
    return { sent: 0, remaining: queue.length, stalled: false, reassigned: [] };
  }

  let sent = 0;
  const reassigned: Reassignment[] = [];
  const idMap = new Map<string, string>();

  // In order, and stop at the first connectivity failure — a later write may
  // depend on an earlier one (a visit needs its patient to exist).
  for (const item of queue) {
    try {
      if (item.kind === "patient") {
        let res = await post(api, "/clinician/patients", item.payload);
        if (res.status === 409) {
          // Somebody else holds this id; the provisional QR must be replaced.
          // First try a number past everything still queued on this device,
          // so the new id cannot land on another offline registration that
          // is waiting behind this one. If even that is taken, let the
          // server assign one.
          const { id: _provisional, ...rest } = item.payload;
          void _provisional;
          const queuedTop = readQueue().reduce(
            (max, q) => (q.kind === "patient" ? Math.max(max, ptNumber(q.payload.id)) : max),
            readHighWater(),
          );
          res = await post(api, "/clinician/patients", { ...rest, id: `PT-${queuedTop + 1}` });
          if (res.status === 409) res = await post(api, "/clinician/patients", rest);
          if (res.ok) {
            const saved = (await res.json()) as Patient;
            raiseHighWater([saved.id]);
            idMap.set(item.payload.id, saved.id);
            const r = {
              from: item.payload.id,
              to: saved.id,
              name: saved.name,
              at: new Date().toISOString(),
            };
            reassigned.push(r);
            recordReassignment(r);
            remapVisits(r.from, r.to);
          }
        }
        if (res.status === 401 || res.status === 403) break;
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          sent += 1;
          removeItem(item);
          continue;
        }
        break;
      }

      if (item.kind === "access") {
        const { id: _local, ...entry } = item.payload;
        void _local;
        const patientId =
          entry.patientId && idMap.has(entry.patientId) ? idMap.get(entry.patientId)! : entry.patientId;
        const res = await post(api, "/clinician/access-log", { ...entry, patientId });
        if (res.status === 401 || res.status === 403) break;
        if (res.ok || (res.status >= 400 && res.status < 500)) {
          sent += 1;
          removeItem(item);
          continue;
        }
        break;
      }

      const visit = idMap.has(item.payload.patientId)
        ? { ...item.payload, patientId: idMap.get(item.payload.patientId)! }
        : item.payload;
      const res = await post(api, "/clinician/visits", visit);

      // Signed out or signed in as someone without clinician rights: the
      // writes are fine, the session is not. Keep everything for after the
      // next sign-in rather than discarding it as rejected.
      if (res.status === 401 || res.status === 403) break;

      // 200 is the server recognising a replay of a visit that already landed.
      if (res.ok) {
        sent += 1;
        removeItem(item);
        continue;
      }

      // Any other 4xx is a genuine rejection. Retrying will not fix it, so
      // drop it rather than blocking everything behind it forever.
      if (res.status >= 400 && res.status < 500) {
        sent += 1;
        removeItem(item);
        continue;
      }

      // 5xx — the server is up but unhappy. Leave the rest queued.
      break;
    } catch (err) {
      if (isConnectivityFailure(err)) break;
      // Anything else is not retryable either.
      sent += 1;
      removeItem(item);
    }
  }

  const remaining = readQueue().length;
  return { sent, remaining, stalled: remaining > 0, reassigned };
}

export function clearQueue(): void {
  if (canPersist()) window.localStorage.removeItem(KEY);
}
