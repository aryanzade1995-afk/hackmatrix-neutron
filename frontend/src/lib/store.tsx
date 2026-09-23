"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  patients as seedPatients,
  visits as seedVisits,
  type Patient,
  type Visit,
} from "./demo-data";
import {
  enqueue,
  flushQueue,
  isConnectivityFailure,
  readQueue,
  type QueuedWrite,
} from "./writeQueue";

/**
 * Backed by the FastAPI layer when it is reachable, and by the seeded arrays
 * when it is not.
 *
 * Reads degrade to seed data because a record screen with no patient is
 * broken. Writes degrade to a durable queue because a consultation should not
 * be lost when the link drops mid-sentence — which, in a rural PHC, is the
 * expected case rather than the exception.
 *
 * The return shape is a superset of the original in-memory version, so every
 * page that calls useStore() keeps working untouched.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Source = "loading" | "api" | "seed";

type Store = {
  patients: Patient[];
  visits: Visit[];
  addPatient: (p: Patient) => void;
  addVisit: (v: Visit) => void;
  source: Source;
  error: string | null;
  /** Writes waiting to reach the server. */
  pendingCount: number;
  /** Briefly true after a queue drains, so the UI can acknowledge it. */
  justSynced: boolean;
};

const StoreContext = createContext<Store | null>(null);

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal, cache: "no-store", credentials: "include" });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [visits, setVisits] = useState<Visit[]>(seedVisits);
  const [source, setSource] = useState<Source>(API ? "loading" : "seed");
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [justSynced, setJustSynced] = useState(false);

  const drain = useCallback(async () => {
    if (!API) return;
    const before = readQueue().length;
    if (before === 0) return;

    const result = await flushQueue(API);
    setPendingCount(result.remaining);

    if (result.sent > 0 && result.remaining === 0) {
      setJustSynced(true);
      setError(null);
      window.setTimeout(() => setJustSynced(false), 4000);
    }
  }, []);

  // Initial load, and a first attempt at anything left over from last session.
  useEffect(() => {
    setPendingCount(readQueue().length);
    if (!API) return;

    const controller = new AbortController();

    (async () => {
      try {
        const [apiPatients, apiVisits] = await Promise.all([
          getJson<Patient[]>("/clinician/patients?limit=500", controller.signal),
          getJson<Visit[]>("/clinician/visits?limit=2000", controller.signal),
        ]);
        setPatients(apiPatients);
        setVisits(apiVisits);
        setSource("api");
        setError(null);
        void drain();
      } catch (err) {
        if (controller.signal.aborted) return;
        setSource("seed");
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => controller.abort();
  }, [drain]);

  // The browser tells us when the link is back; take it as a cue to retry.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => void drain();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [drain]);

  function queueWrite(item: QueuedWrite) {
    const next = enqueue(item);
    setPendingCount(next.length);
  }

  /**
   * Writes update local state first so the UI stays instant, then persist in
   * the background. A connectivity failure queues the payload for replay; a
   * response the server actually sent is a real rejection and is surfaced
   * instead, because retrying a bad payload forever helps nobody.
   */
  const addPatient = useCallback((p: Patient) => {
    setPatients((prev) => [...prev, p]);
    if (!API) return;

    void fetch(`${API}/clinician/patients`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    })
      .then((res) => {
        if (res.ok || res.status === 409) {
          setError(null);
          return;
        }
        if (res.status >= 500) {
          queueWrite({ kind: "patient", payload: p, queuedAt: new Date().toISOString() });
          return;
        }
        throw new Error(`POST /clinician/patients → ${res.status}`);
      })
      .catch((err: unknown) => {
        if (isConnectivityFailure(err)) {
          queueWrite({ kind: "patient", payload: p, queuedAt: new Date().toISOString() });
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const addVisit = useCallback((v: Visit) => {
    setVisits((prev) => [v, ...prev]);
    if (!API) return;

    void fetch(`${API}/clinician/visits`, {
      credentials: "include",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    })
      .then((res) => {
        if (res.ok || res.status === 409) {
          setError(null);
          return;
        }
        if (res.status >= 500) {
          queueWrite({ kind: "visit", payload: v, queuedAt: new Date().toISOString() });
          return;
        }
        throw new Error(`POST /clinician/visits → ${res.status}`);
      })
      .catch((err: unknown) => {
        if (isConnectivityFailure(err)) {
          queueWrite({ kind: "visit", payload: v, queuedAt: new Date().toISOString() });
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
      });
  }, []);

  const value = useMemo(
    () => ({
      patients,
      visits,
      addPatient,
      addVisit,
      source,
      error,
      pendingCount,
      justSynced,
    }),
    [patients, visits, addPatient, addVisit, source, error, pendingCount, justSynced],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
