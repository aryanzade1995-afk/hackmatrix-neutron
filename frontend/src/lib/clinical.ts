import type { Allergy, Prescription, Visit, Vitals } from "./demo-data";

/* ------------------------------------------------------------------ *
 * Allergy conflicts
 * ------------------------------------------------------------------ */

export type Conflict = {
  visit: Visit;
  prescription: Prescription;
  allergy: Allergy;
};

/**
 * A prescription conflicts with an allergy when they share a drug class.
 * Prototype logic over synthetic data — not clinical decision support.
 */
export function findAllergyConflicts(
  visits: Visit[],
  allergies: Allergy[],
): Conflict[] {
  const conflicts: Conflict[] = [];

  for (const visit of visits) {
    for (const prescription of visit.prescriptions) {
      const allergy = allergies.find((a) => a.drugClass === prescription.drugClass);
      if (allergy) conflicts.push({ visit, prescription, allergy });
    }
  }

  return conflicts;
}

/** Conflicts on one visit, for inline flags in the timeline. */
export function conflictsForVisit(visit: Visit, allergies: Allergy[]): Conflict[] {
  return findAllergyConflicts([visit], allergies);
}

/* ------------------------------------------------------------------ *
 * Vitals trends
 * ------------------------------------------------------------------ */

export type VitalKey = "systolic" | "diastolic" | "hba1c" | "weightKg" | "heartRate";

export type VitalPoint = { date: string; display: string; value: number };

/** Chronological (oldest first), skipping visits where the vital wasn't taken. */
export function vitalSeries(visits: Visit[], key: VitalKey): VitalPoint[] {
  return [...visits]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((v) => ({ date: v.date, display: v.display, value: v.vitals[key] }))
    .filter((p): p is VitalPoint => typeof p.value === "number");
}

export type Direction = "up" | "down" | "flat";

/** Direction of travel between the first and last reading. */
export function trendOf(series: VitalPoint[]): Direction {
  if (series.length < 2) return "flat";
  const delta = series[series.length - 1].value - series[0].value;
  if (Math.abs(delta) < 0.001) return "flat";
  return delta > 0 ? "up" : "down";
}

/* ------------------------------------------------------------------ *
 * What changed since the previous visit
 * ------------------------------------------------------------------ */

export type Change =
  | { kind: "vital"; label: string; from: string; to: string; better: boolean | null }
  | { kind: "started"; label: string; detail: string }
  | { kind: "stopped"; label: string; detail: string }
  | { kind: "diagnosis"; label: string; detail: string };

const VITAL_LABELS: Record<VitalKey, { label: string; unit: string; lowerIsBetter: boolean }> = {
  systolic: { label: "Systolic BP", unit: "mmHg", lowerIsBetter: true },
  diastolic: { label: "Diastolic BP", unit: "mmHg", lowerIsBetter: true },
  hba1c: { label: "HbA1c", unit: "%", lowerIsBetter: true },
  weightKg: { label: "Weight", unit: "kg", lowerIsBetter: false },
  heartRate: { label: "Resting HR", unit: "bpm", lowerIsBetter: true },
};

function drugKey(p: Prescription) {
  return `${p.drug} ${p.dose}`;
}

/**
 * Compares the two most recent visits and reports what a returning
 * clinician would actually want to know: what's new, what stopped, and
 * which numbers moved.
 */
export function changesSinceLastVisit(visits: Visit[]): {
  current: Visit;
  previous: Visit;
  changes: Change[];
} | null {
  if (visits.length < 2) return null;

  const ordered = [...visits].sort((a, b) => b.date.localeCompare(a.date));
  const [current, previous] = ordered;
  const changes: Change[] = [];

  // Diagnosis
  if (current.diagnosis !== previous.diagnosis) {
    changes.push({
      kind: "diagnosis",
      label: current.diagnosis,
      detail: `previously seen for ${previous.diagnosis.toLowerCase()}`,
    });
  }

  // Medication starts and stops.
  //
  // "Started" means never prescribed before, not merely absent from the last
  // visit — otherwise an unrelated interim visit (a throat infection, say)
  // makes long-standing medication look brand new.
  const currentDrugs = new Map(current.prescriptions.map((p) => [drugKey(p), p]));
  const previousDrugs = new Map(previous.prescriptions.map((p) => [drugKey(p), p]));

  const everPrescribedBefore = new Set<string>();
  for (const visit of ordered.slice(1)) {
    for (const p of visit.prescriptions) everPrescribedBefore.add(drugKey(p));
  }

  for (const [key, p] of currentDrugs) {
    if (!everPrescribedBefore.has(key)) {
      changes.push({ kind: "started", label: p.drug, detail: p.dose });
    }
  }
  for (const [key, p] of previousDrugs) {
    if (!currentDrugs.has(key)) {
      changes.push({ kind: "stopped", label: p.drug, detail: p.dose });
    }
  }

  // Vitals that moved
  for (const key of Object.keys(VITAL_LABELS) as VitalKey[]) {
    const to = current.vitals[key];
    const from = previous.vitals[key];
    if (typeof to !== "number" || typeof from !== "number" || to === from) continue;

    const meta = VITAL_LABELS[key];
    changes.push({
      kind: "vital",
      label: meta.label,
      from: `${from}${meta.unit === "%" ? "%" : ` ${meta.unit}`}`,
      to: `${to}${meta.unit === "%" ? "%" : ` ${meta.unit}`}`,
      better: meta.lowerIsBetter ? to < from : null,
    });
  }

  return { current, previous, changes };
}

/* ------------------------------------------------------------------ *
 * Shared helper
 * ------------------------------------------------------------------ */

export function formatBp(v: Vitals) {
  return `${v.systolic}/${v.diastolic}`;
}
