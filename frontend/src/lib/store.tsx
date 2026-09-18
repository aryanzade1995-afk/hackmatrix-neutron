"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  patients as seedPatients,
  visits as seedVisits,
  type Patient,
  type Visit,
} from "./demo-data";

/**
 * Session-scoped store standing in for the backend.
 *
 * Both collections are append-only: a visit is never edited once saved, which
 * matches the audit-log philosophy in the rest of the project. A correction is
 * a new visit carrying `supersedes`, not a mutation of the original.
 */
type Store = {
  patients: Patient[];
  visits: Visit[];
  addPatient: (p: Patient) => void;
  addVisit: (v: Visit) => void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [visits, setVisits] = useState<Visit[]>(seedVisits);

  const addPatient = useCallback((p: Patient) => {
    setPatients((prev) => [...prev, p]);
  }, []);

  const addVisit = useCallback((v: Visit) => {
    setVisits((prev) => [v, ...prev]);
  }, []);

  const value = useMemo(
    () => ({ patients, visits, addPatient, addVisit }),
    [patients, visits, addPatient, addVisit],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
