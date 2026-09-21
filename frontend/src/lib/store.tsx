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

/**
 * Backed by the FastAPI layer when it is reachable, and by the seeded arrays
 * when it is not.
 *
 * The fallback is deliberate rather than lazy. A demo that shows an error
 * screen because a laptop lost its network is worse than one that quietly runs
 * on synthetic data, and `source` below makes which one is in play inspectable
 * instead of ambiguous.
 *
 * The return shape is unchanged from the in-memory version, so every page that
 * calls useStore() keeps working untouched.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type Source = "loading" | "api" | "seed";

type Store = {
  patients: Patient[];
  visits: Visit[];
  addPatient: (p: Patient) => void;
  addVisit: (v: Visit) => void;
  /** Where the current data came from. Additive — no page is required to use it. */
  source: Source;
  error: string | null;
};

const StoreContext = createContext<Store | null>(null);

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal, cache: "no-store" });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return (await res.json()) as T;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [visits, setVisits] = useState<Visit[]>(seedVisits);
  const [source, setSource] = useState<Source>(API ? "loading" : "seed");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
      } catch (err) {
        if (controller.signal.aborted) return;
        // Keep the seeded arrays already in state — the UI stays usable.
        setSource("seed");
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => controller.abort();
  }, []);

  /**
   * Writes update local state first so the UI stays as instant as it was on
   * the mock store, then persist in the background. A failed POST is reported
   * through `error` rather than rolled back: losing what a doctor just typed
   * mid-consultation would be worse than holding it locally until they retry.
   */
  const addPatient = useCallback((p: Patient) => {
    setPatients((prev) => [...prev, p]);
    if (!API) return;
    void fetch(`${API}/clinician/patients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`POST /clinician/patients → ${res.status}`);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  const addVisit = useCallback((v: Visit) => {
    setVisits((prev) => [v, ...prev]);
    if (!API) return;
    void fetch(`${API}/clinician/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...v, date: v.date }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`POST /clinician/visits → ${res.status}`);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, []);

  const value = useMemo(
    () => ({ patients, visits, addPatient, addVisit, source, error }),
    [patients, visits, addPatient, addVisit, source, error],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
