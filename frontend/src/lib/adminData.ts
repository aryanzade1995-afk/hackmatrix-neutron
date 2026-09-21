"use client";

import { useEffect, useState } from "react";

/**
 * Read-only hooks for the administrator dashboard.
 *
 * Note what is deliberately missing: there is no seed-data fallback here,
 * unlike `store.tsx`. The clinician side falls back to synthetic patients
 * because a record screen with no patient is simply broken. The admin side
 * must not — showing stale mock numbers as though they were live would
 * undercut the one claim the whole database layer exists to prove. If the API
 * is unreachable the dashboard says so.
 *
 * There is also no write equivalent of addPatient/addVisit, because no admin
 * action ever writes to patients or visits.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export type AggregateRow = {
  district: string;
  diagnosis: string;
  caseCount: number;
  week?: string | null;
};

export type TrendSignal = {
  district: string;
  diagnosis: string;
  week: string;
  currentCount: number;
  baselineAvg: number;
  ratio: number;
  severity: "watch" | "alert";
};

export type ApiState<T> = {
  data: T[];
  source: "loading" | "api" | "unavailable";
  error: string | null;
};

function useApiList<T>(path: string): ApiState<T> {
  const [data, setData] = useState<T[]>([]);
  const [source, setSource] = useState<ApiState<T>["source"]>(
    API ? "loading" : "unavailable",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!API) {
      setSource("unavailable");
      setError("NEXT_PUBLIC_API_URL is not set");
      return;
    }

    const controller = new AbortController();

    fetch(`${API}${path}`, { signal: controller.signal, cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`${path} → ${res.status}`);
        return res.json();
      })
      .then((rows: T[]) => {
        setData(rows);
        setSource("api");
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setSource("unavailable");
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => controller.abort();
  }, [path]);

  return { data, source, error };
}

/** Totals by district and condition, already suppressed by the view. */
export function useTrends() {
  return useApiList<AggregateRow>("/admin/trends?limit=200");
}

/** Weekly counts, optionally narrowed. */
export function useAggregates(district?: string, diagnosis?: string) {
  const qs = new URLSearchParams();
  if (district) qs.set("district", district);
  if (diagnosis) qs.set("diagnosis", diagnosis);
  const query = qs.toString();
  return useApiList<AggregateRow>(`/admin/aggregates${query ? `?${query}` : ""}`);
}

/** Pairs whose latest week sits well above their own trailing average. */
export function useSignals() {
  return useApiList<TrendSignal>("/admin/signals");
}

/** Districts and conditions present in the data, derived from the totals. */
export function distinctFrom(rows: AggregateRow[]) {
  return {
    districts: [...new Set(rows.map((r) => r.district))].sort(),
    diagnoses: [...new Set(rows.map((r) => r.diagnosis))].sort(),
  };
}
