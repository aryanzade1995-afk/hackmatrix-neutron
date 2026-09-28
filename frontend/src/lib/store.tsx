"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  patients as seedPatients,
  visits as seedVisits,
  type Patient,
  type Visit,
} from "./demo-data";
import { nextPatientId } from "./clinical";
import {
  dismissReassignment,
  enqueue,
  flushQueue,
  isConnectivityFailure,
  raiseHighWater,
  readHighWater,
  readQueue,
  readReassignments,
  QUEUE_EVENT,
  type QueuedWrite,
  type Reassignment,
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

/** Patients and visits still waiting in the offline queue. */
function queuedRecords(): { patients: Patient[]; visits: Visit[] } {
  const q = readQueue();
  return {
    patients: q.flatMap((i) => (i.kind === "patient" ? [i.payload] : [])),
    visits: q.flatMap((i) => (i.kind === "visit" ? [i.payload] : [])),
  };
}

function mergeById<T extends { id: string }>(base: T[], extra: T[]): T[] {
  const ids = new Set(base.map((x) => x.id));
  return [...base, ...extra.filter((x) => !ids.has(x.id))];
}

type Source = "loading" | "api" | "seed";

/**
 * What happened to a registration.
 *
 *  - saved: the server confirmed it. `patient.id` is the id the server holds,
 *    which is the one the QR must encode. `reassignedFrom` is set when the
 *    proposed id had been taken and the server assigned a different one.
 *  - queued: no connection. Kept on this device and replayed later; the id is
 *    provisional until then.
 *  - error: the server refused it. Nothing was registered.
 */
export type RegisterOutcome =
  | { status: "saved"; patient: Patient; reassignedFrom?: string }
  | { status: "queued"; patient: Patient }
  | { status: "error"; message: string };

type Store = {
  patients: Patient[];
  visits: Visit[];
  /** The id to propose for the next registration. The server has the last word. */
  proposePatientId: () => string;
  /** Registers a patient and resolves once the server has answered. */
  registerPatient: (p: Patient) => Promise<RegisterOutcome>;
  /** Adds a patient fetched individually (e.g. by a scan) to the local list. */
  rememberPatient: (p: Patient) => void;
  addVisit: (v: Visit) => void;
  /** Offline registrations whose provisional id had to change on sync. */
  reassigned: Reassignment[];
  dismissReassigned: (from: string) => void;
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
  const [reassigned, setReassigned] = useState<Reassignment[]>([]);
  // Patients fetched one at a time (a scan of someone outside the bulk list)
  // survive the next bulk load instead of being replaced by it.
  const remembered = useRef(new Map<string, Patient>());

  // The provider lives in the root layout, so it first mounts on the home or
  // login page, before any session cookie exists. Loading only inside the
  // clinician area, and again on every entry to it, means a sign-in is picked
  // up without a page reload, and the admin and public pages never ask for
  // identified data they are not allowed to have.
  const pathname = usePathname();
  const inClinicianArea = pathname?.startsWith("/clinician") ?? false;

  const drain = useCallback(async () => {
    if (!API || !window.location.pathname.startsWith("/clinician")) return;
    const before = readQueue().length;
    if (before === 0) return;

    const result = await flushQueue(API);
    setPendingCount(result.remaining);
    if (result.reassigned.length > 0) setReassigned(readReassignments());

    // Whatever was sent, the server now holds the truth — including patients
    // whose provisional id changed. Reload rather than patch ids locally:
    // patching by id renamed the wrong row whenever the server already had a
    // different patient under the provisional id.
    if (result.sent > 0) {
      try {
        const signal = new AbortController().signal;
        const [apiPatients, apiVisits] = await Promise.all([
          getJson<Patient[]>("/clinician/patients?limit=2000", signal),
          getJson<Visit[]>("/clinician/visits?limit=5000", signal),
        ]);
        const queued = queuedRecords();
        setPatients(
          mergeById(mergeById(apiPatients, [...remembered.current.values()]), queued.patients),
        );
        setVisits(mergeById(apiVisits, queued.visits));
      } catch {
        /* the next load picks it up */
      }
    }

    if (result.sent > 0 && result.remaining === 0) {
      setJustSynced(true);
      setError(null);
      window.setTimeout(() => setJustSynced(false), 4000);
    }
  }, []);

  // Initial load, and a first attempt at anything left over from last session.
  useEffect(() => {
    setPendingCount(readQueue().length);
    setReassigned(readReassignments());
    if (!API) return;

    if (!inClinicianArea) {
      // Leaving the clinician area (sign-out included): nothing identified
      // stays in memory from the previous session.
      setPatients(seedPatients);
      setVisits(seedVisits);
      remembered.current.clear();
      setSource("loading");
      setError(null);
      return;
    }

    const controller = new AbortController();
    setSource("loading");

    (async () => {
      try {
        const [apiPatients, apiVisits] = await Promise.all([
          getJson<Patient[]>("/clinician/patients?limit=2000", controller.signal),
          getJson<Visit[]>("/clinician/visits?limit=5000", controller.signal),
        ]);
        raiseHighWater(apiPatients.map((p) => p.id));
        // Server rows first; then anything fetched one at a time, and anything
        // registered offline that has not reached the server yet — otherwise a
        // patient registered this morning is "not found" after a reload.
        const queued = queuedRecords();
        setPatients(
          mergeById(mergeById(apiPatients, [...remembered.current.values()]), queued.patients),
        );
        setVisits(mergeById(apiVisits, queued.visits));
        setSource("api");
        setError(null);
        void drain();
      } catch (err) {
        if (controller.signal.aborted) return;
        const queued = queuedRecords();
        setPatients(mergeById(seedPatients, queued.patients));
        setVisits(mergeById(seedVisits, queued.visits));
        setSource("seed");
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => controller.abort();
  }, [drain, inClinicianArea]);

  // The browser tells us when the link is back; take it as a cue to retry.
  // Writes queued from outside the store (audit entries) update the count.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => void drain();
    const onQueue = () => setPendingCount(readQueue().length);
    window.addEventListener("online", onOnline);
    window.addEventListener(QUEUE_EVENT, onQueue);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener(QUEUE_EVENT, onQueue);
    };
  }, [drain]);

  function queueWrite(item: QueuedWrite) {
    const next = enqueue(item);
    setPendingCount(next.length);
  }

  const upsertPatient = useCallback((p: Patient) => {
    raiseHighWater([p.id]);
    setPatients((prev) => [...prev.filter((x) => x.id !== p.id), p]);
  }, []);

  const proposePatientId = useCallback(
    () => nextPatientId([...patients, ...queuedRecords().patients], readHighWater()),
    [patients],
  );

  const rememberPatient = useCallback(
    (p: Patient) => {
      remembered.current.set(p.id, p);
      upsertPatient(p);
    },
    [upsertPatient],
  );

  /**
   * Registration waits for the server, unlike visit writes, because its
   * result is printed: the QR must encode the id the server actually holds.
   *
   * The proposed id is honoured when it is free. A 409 means another patient
   * already has it — registering again without an id lets the server assign
   * the next free one, and that is the id returned. Only a connection failure
   * falls back to the offline queue, where the id stays provisional.
   */
  const registerPatient = useCallback(
    async (p: Patient): Promise<RegisterOutcome> => {
      if (!API) {
        upsertPatient(p);
        return { status: "queued", patient: p };
      }

      const send = (body: unknown) =>
        fetch(`${API}/clinician/patients`, {
          credentials: "include",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

      const queueOffline = (): RegisterOutcome => {
        queueWrite({ kind: "patient", payload: p, queuedAt: new Date().toISOString() });
        upsertPatient(p);
        return { status: "queued", patient: p };
      };

      try {
        let res = await send(p);
        let reassignedFrom: string | undefined;
        if (res.status === 409) {
          reassignedFrom = p.id;
          const { id: _taken, ...withoutId } = p;
          void _taken;
          res = await send(withoutId);
        }

        if (res.ok) {
          const saved = (await res.json()) as Patient;
          const patient: Patient = { ...saved, phone: saved.phone ?? undefined };
          rememberPatient(patient);
          setError(null);
          return {
            status: "saved",
            patient,
            reassignedFrom: reassignedFrom && reassignedFrom !== patient.id ? reassignedFrom : undefined,
          };
        }
        if (res.status >= 500) return queueOffline();

        const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
        const message =
          typeof body?.detail === "string"
            ? body.detail
            : `The server refused the registration (${res.status}).`;
        setError(message);
        return { status: "error", message };
      } catch (err) {
        if (isConnectivityFailure(err)) return queueOffline();
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        return { status: "error", message };
      }
    },
    // queueWrite only touches setState and localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upsertPatient, rememberPatient],
  );

  const dismissReassigned = useCallback((from: string) => {
    setReassigned(dismissReassignment(from));
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
      proposePatientId,
      registerPatient,
      rememberPatient,
      addVisit,
      reassigned,
      dismissReassigned,
      source,
      error,
      pendingCount,
      justSynced,
    }),
    [
      patients,
      visits,
      proposePatientId,
      registerPatient,
      rememberPatient,
      addVisit,
      reassigned,
      dismissReassigned,
      source,
      error,
      pendingCount,
      justSynced,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
