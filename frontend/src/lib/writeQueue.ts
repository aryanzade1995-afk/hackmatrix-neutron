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
 * Replay is safe because ids are generated client-side: the same POST sent
 * twice hits the backend's "honour a client-supplied id, 409 if taken" path,
 * so a 409 on replay means an earlier attempt actually landed and the item can
 * be dropped. No server-side idempotency key is needed.
 */

const KEY = "hackmatrix.writeQueue.v1";

export type QueuedWrite =
  | { kind: "patient"; payload: Patient; queuedAt: string }
  | { kind: "visit"; payload: Visit; queuedAt: string };

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
};

export async function flushQueue(api: string): Promise<FlushResult> {
  const queue = readQueue();
  if (queue.length === 0 || !api) {
    return { sent: 0, remaining: queue.length, stalled: false };
  }

  let sent = 0;

  // In order, and stop at the first connectivity failure — a later write may
  // depend on an earlier one (a visit needs its patient to exist).
  for (const item of queue) {
    const path = item.kind === "patient" ? "/clinician/patients" : "/clinician/visits";
    try {
      const res = await fetch(`${api}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload),
      });

      // 409 means an earlier attempt reached the server even though its
      // response was lost. The write succeeded; drop it.
      if (res.ok || res.status === 409) {
        sent += 1;
        continue;
      }

      // Any other 4xx is a genuine rejection. Retrying will not fix it, so
      // drop it rather than blocking everything behind it forever.
      if (res.status >= 400 && res.status < 500) {
        sent += 1;
        continue;
      }

      // 5xx — the server is up but unhappy. Leave the rest queued.
      break;
    } catch (err) {
      if (isConnectivityFailure(err)) break;
      // Anything else is not retryable either.
      sent += 1;
    }
  }

  const remaining = queue.slice(sent);
  writeQueue(remaining);
  return { sent, remaining: remaining.length, stalled: remaining.length > 0 };
}

export function clearQueue(): void {
  if (canPersist()) window.localStorage.removeItem(KEY);
}
