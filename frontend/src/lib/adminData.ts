"use client";

import { useCallback, useEffect, useState } from "react";

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
  baselineSd: number;
  zScore: number;
  baselineWeeks: number;
  ratio: number;
  severity: "watch" | "alert";
};

export type FacilityActivity = {
  facility: string;
  caseCount: number;
  patientCount: number;
  lastWeek: string;
};

export type ApiState<T> = {
  data: T[];
  source: "loading" | "api" | "unavailable";
  error: string | null;
  /** When the last successful read landed, for the "updated Xs ago" label. */
  fetchedAt: number | null;
  /** Re-runs the request. Used by the manual refresh control. */
  reload: () => void;
};

function useApiList<T>(path: string): ApiState<T> {
  const [data, setData] = useState<T[]>([]);
  const [source, setSource] = useState<ApiState<T>["source"]>(
    API ? "loading" : "unavailable",
  );
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);

  // Bumping this re-runs the effect. A counter rather than a boolean so two
  // refreshes in quick succession are two distinct reads, not one.
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!API) {
      setSource("unavailable");
      setError("NEXT_PUBLIC_API_URL is not set");
      return;
    }

    const controller = new AbortController();

    fetch(`${API}${path}`, { signal: controller.signal, cache: "no-store", credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`${path} → ${res.status}`);
        return res.json();
      })
      .then((rows: T[]) => {
        setData(rows);
        setSource("api");
        setError(null);
        setFetchedAt(Date.now());
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setSource("unavailable");
        setError(err instanceof Error ? err.message : String(err));
      });

    return () => controller.abort();
  }, [path, nonce]);

  return { data, source, error, fetchedAt, reload };
}

/** Totals by district and condition, already suppressed by the view. */
export function useTrends() {
  return useApiList<AggregateRow>("/admin/trends?limit=200");
}

/**
 * Weekly counts, optionally narrowed.
 *
 * The endpoint returns one row per district x condition x week, and defaults to
 * a limit of 200 — which silently truncates the oldest weeks and makes a chart
 * built from it under-count. Ask for the endpoint's maximum instead; with four
 * districts and ten conditions over a quarter, that covers the whole series.
 */
export const AGGREGATE_LIMIT = 1000;

export function useAggregates(district?: string, diagnosis?: string) {
  const qs = new URLSearchParams();
  if (district) qs.set("district", district);
  if (diagnosis) qs.set("diagnosis", diagnosis);
  qs.set("limit", String(AGGREGATE_LIMIT));
  return useApiList<AggregateRow>(`/admin/aggregates?${qs.toString()}`);
}

/**
 * Collapses the per-district, per-condition rows into one total per week.
 *
 * Without this, plotting the rows directly draws one bar per row — several bars
 * sharing a single week, and an axis that repeats the same date.
 */
export function weeklyTotals(rows: AggregateRow[]) {
  const byWeek = new Map<string, number>();
  for (const r of rows) {
    if (!r.week) continue;
    byWeek.set(r.week, (byWeek.get(r.week) ?? 0) + r.caseCount);
  }
  return [...byWeek.entries()]
    .map(([week, cases]) => ({ week, cases }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

/** Pairs whose latest week sits well above their own trailing average. */
export function useSignals() {
  return useApiList<TrendSignal>("/admin/signals");
}

/** Which facilities are reporting, and when they last did. */
export function useFacilities() {
  return useApiList<FacilityActivity>("/admin/facilities");
}

/**
 * Pivots weekly rows into one series per condition, for a multi-line chart.
 *
 * Districts are summed together: the chart answers "which conditions are
 * moving across the division", and the per-district breakdown is the heatmap's
 * job. Only the top `limit` conditions get a line — a legend with ten entries
 * is a wall, not a chart.
 */
export function weeklyByCondition(rows: AggregateRow[], limit = 4) {
  const totals = new Map<string, number>();
  for (const r of rows) {
    if (!r.week) continue;
    totals.set(r.diagnosis, (totals.get(r.diagnosis) ?? 0) + r.caseCount);
  }
  const top = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([diagnosis]) => diagnosis);

  const byWeek = new Map<string, Record<string, number | string>>();
  for (const r of rows) {
    if (!r.week || !top.includes(r.diagnosis)) continue;
    const row = byWeek.get(r.week) ?? { week: r.week };
    row[r.diagnosis] = ((row[r.diagnosis] as number) ?? 0) + r.caseCount;
    byWeek.set(r.week, row);
  }

  // Zero-fill so a condition with no cases in a week draws a point at zero
  // rather than a gap the eye reads as "no data".
  const series = [...byWeek.values()]
    .map((row) => {
      for (const c of top) if (row[c] === undefined) row[c] = 0;
      return row;
    })
    .sort((a, b) => String(a.week).localeCompare(String(b.week)));

  return { conditions: top, series };
}

/** Districts and conditions present in the data, derived from the totals. */
export function distinctFrom(rows: AggregateRow[]) {
  return {
    districts: [...new Set(rows.map((r) => r.district))].sort(),
    diagnoses: [...new Set(rows.map((r) => r.diagnosis))].sort(),
  };
}

/* -------------------------------------------------------------------------
 * Privacy/utility tradeoff curve
 * ---------------------------------------------------------------------- */

export type ThresholdPoint = { k: number; groups: number; casesRetained: number };

export type ThresholdCurve = {
  productionK: number;
  points: ThresholdPoint[];
  totalCases: number;
  computedBy: string;
  disclosure: string;
};

/**
 * The evidence for choosing k=5.
 *
 * Its own hook rather than useApiList because the endpoint returns an object,
 * not a list — and because it is the one admin-dashboard read that is NOT
 * served over the aggregate connection. That role cannot compute this curve:
 * the numbers below k=5 are precisely what its views remove.
 */
export function useThresholdCurve() {
  const [data, setData] = useState<ThresholdCurve | null>(null);
  const [source, setSource] = useState<"loading" | "api" | "unavailable">(
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
    fetch(`${API}/admin/threshold-curve`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`threshold-curve → ${res.status}`);
        return res.json();
      })
      .then((body: ThresholdCurve) => {
        setData(body);
        setSource("api");
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setSource("unavailable");
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => controller.abort();
  }, []);

  return { data, source, error };
}

/**
 * Weekly frames for the heatmap time-lapse.
 *
 * One frame per week, each holding that week's district|diagnosis counts.
 * `max` is computed across *every* frame rather than per frame, so a cell's
 * colour means the same thing in week 1 as in week 13 — a per-frame scale
 * would renormalise on every step and make a quiet week look identical to a
 * busy one.
 */
export function weeklyFrames(rows: AggregateRow[]) {
  const byWeek = new Map<string, Map<string, number>>();
  let max = 1;

  for (const r of rows) {
    if (!r.week) continue;
    const frame = byWeek.get(r.week) ?? new Map<string, number>();
    const key = `${r.district}|${r.diagnosis}`;
    const next = (frame.get(key) ?? 0) + r.caseCount;
    frame.set(key, next);
    byWeek.set(r.week, frame);
    if (next > max) max = next;
  }

  const weeks = [...byWeek.keys()].sort((a, b) => a.localeCompare(b));
  return { weeks, frames: byWeek, max };
}


/* -------------------------------------------------------------------------
 * Forecast
 * ---------------------------------------------------------------------- */

export type ForecastPoint = {
  week: string;
  actual: number | null;
  forecast: number | null;
  lower: number | null;
  upper: number | null;
};

export type Forecast = {
  points: ForecastPoint[];
  /** Names the model that actually ran, including the fallbacks. */
  method: string;
  caveat: string;
};

/**
 * A short projection of the filtered weekly series.
 *
 * Its own hook rather than useApiList because the endpoint returns an object.
 * The filters are the same ones driving the chart, so the projection always
 * describes the series on screen rather than some other one.
 */
export function useForecast(district?: string, diagnosis?: string) {
  const [data, setData] = useState<Forecast | null>(null);
  const [source, setSource] = useState<"loading" | "api" | "unavailable">(
    API ? "loading" : "unavailable",
  );
  const [error, setError] = useState<string | null>(null);

  const qs = new URLSearchParams();
  if (district) qs.set("district", district);
  if (diagnosis) qs.set("diagnosis", diagnosis);
  const query = qs.toString();

  useEffect(() => {
    if (!API) {
      setSource("unavailable");
      setError("NEXT_PUBLIC_API_URL is not set");
      return;
    }
    const controller = new AbortController();
    setSource("loading");
    fetch(`${API}/admin/forecast${query ? `?${query}` : ""}`, {
      signal: controller.signal,
      cache: "no-store",
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`forecast → ${res.status}`);
        return res.json();
      })
      .then((body: Forecast) => {
        setData(body);
        setSource("api");
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setSource("unavailable");
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => controller.abort();
  }, [query]);

  return { data, source, error };
}
