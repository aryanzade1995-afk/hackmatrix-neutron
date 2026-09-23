import type {
  Allergy,
  ChiefComplaint,
  Patient,
  Visit,
  Vitals,
} from "./demo-data";
import { formularyFor, type MedicineOption } from "./formulary";
import type { Prescription } from "./prescribing";
import { formatFrequency } from "./prescribing";

/* ------------------------------------------------------------------ *
 * Patients
 * ------------------------------------------------------------------ */

/** Age is always derived, never stored, so it cannot go stale. */
export function ageFromDob(dob: string, asOf = new Date()): number {
  const birth = new Date(dob);
  let age = asOf.getFullYear() - birth.getFullYear();
  const monthDelta = asOf.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && asOf.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function findPatientById(
  patients: Patient[],
  id: string | null | undefined,
): Patient | undefined {
  if (!id) return undefined;
  return patients.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

/** Case-insensitive contains match on name, phone, or id. */
export function findPatientsByQuery(patients: Patient[], query: string): Patient[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return patients.filter((p) => {
    const phone = (p.phone ?? "").toLowerCase().replace(/\s/g, "");
    return (
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      phone.includes(q.replace(/\s/g, ""))
    );
  });
}

export function visitsForPatient(visits: Visit[], patientId: string): Visit[] {
  return visits.filter((v) => v.patientId === patientId);
}

/** Next sequential id in the PT-#### series. */
export function nextPatientId(patients: Patient[]): string {
  const highest = patients.reduce((max, p) => {
    const n = Number.parseInt(p.id.replace(/\D/g, ""), 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return `PT-${highest + 1}`;
}

/* ------------------------------------------------------------------ *
 * Chief complaints
 * ------------------------------------------------------------------ */

/** Filters the complaint list by the patient's age and gender. */
export function applicableComplaintsFor(
  patient: Patient,
  complaints: ChiefComplaint[],
): ChiefComplaint[] {
  const age = ageFromDob(patient.dob);
  return complaints.filter(({ appliesTo }) => {
    if (!appliesTo) return true;
    if (appliesTo.minAge !== undefined && age < appliesTo.minAge) return false;
    if (appliesTo.maxAge !== undefined && age > appliesTo.maxAge) return false;
    if (appliesTo.genders && !appliesTo.genders.includes(patient.gender)) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Medicines
 *
 * Neither helper below claims a medicine is correct. One reports what has
 * actually been prescribed here before, the other what this patient was
 * given last time. Both are conveniences for typing speed — the choice
 * stays entirely with the doctor, who can also type anything at all.
 * ------------------------------------------------------------------ */

export function topMedicinesForDiagnosis(
  visits: Visit[],
  diagnosis: string,
  facility: string,
  limit = 3,
): MedicineOption[] {
  const formulary = formularyFor(facility);
  const target = diagnosis.trim().toLowerCase();

  if (target) {
    const counts = new Map<string, number>();
    for (const visit of visits) {
      if (visit.facility !== facility) continue;
      if (visit.diagnosis.trim().toLowerCase() !== target) continue;
      for (const p of visit.prescriptions) {
        counts.set(p.drug, (counts.get(p.drug) ?? 0) + 1);
      }
    }

    if (counts.size > 0) {
      const ranked = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([drug]) => formulary.find((m) => m.drug === drug))
        .filter((m): m is MedicineOption => Boolean(m));
      if (ranked.length > 0) return ranked.slice(0, limit);
    }
  }

  // Cold start: a diagnosis never recorded here before.
  return [...formulary].sort((a, b) => a.drug.localeCompare(b.drug)).slice(0, limit);
}

/** This patient's own most recent prescription, optionally for the same diagnosis. */
export function lastPrescriptionForPatient(
  visits: Visit[],
  patientId: string,
  diagnosis?: string,
): { prescriptions: Prescription[]; visit: Visit } | null {
  const mine = visitsForPatient(visits, patientId)
    .filter((v) => v.prescriptions.length > 0)
    .filter((v) =>
      diagnosis
        ? v.diagnosis.trim().toLowerCase() === diagnosis.trim().toLowerCase()
        : true,
    )
    .sort((a, b) => b.date.localeCompare(a.date));

  const latest = mine[0];
  return latest ? { prescriptions: latest.prescriptions, visit: latest } : null;
}

/**
 * Complaints ordered by how often this facility has actually recorded them,
 * commonest first, with the rest following in their declared order. A PHC's
 * caseload is dominated by a handful of presentations, so this keeps the
 * common case to one tap without hiding anything.
 */
export function rankedComplaintsFor(
  visits: Visit[],
  complaints: ChiefComplaint[],
  facility: string,
): ChiefComplaint[] {
  const counts = new Map<string, number>();
  for (const v of visits) {
    if (v.facility !== facility || !v.chiefComplaint) continue;
    counts.set(v.chiefComplaint, (counts.get(v.chiefComplaint) ?? 0) + 1);
  }

  return [...complaints].sort((a, b) => {
    const diff = (counts.get(b.label) ?? 0) - (counts.get(a.label) ?? 0);
    if (diff !== 0) return diff;
    return complaints.indexOf(a) - complaints.indexOf(b);
  });
}

/**
 * Medicines prescribed most recently at this facility — the working
 * repertoire, which emerges from use rather than being configured.
 *
 * Note: visits carry no prescriber field yet, so this is facility-level.
 * Once the backend records who wrote each prescription this can narrow to
 * the signed-in clinician.
 */
export function recentlyPrescribed(
  visits: Visit[],
  facility: string,
  formulary: MedicineOption[],
  limit = 6,
): MedicineOption[] {
  const seen: string[] = [];
  const ordered = [...visits]
    .filter((v) => v.facility === facility)
    .sort((a, b) => b.date.localeCompare(a.date));

  for (const visit of ordered) {
    for (const p of visit.prescriptions) {
      if (!seen.includes(p.drug)) seen.push(p.drug);
    }
    if (seen.length >= limit) break;
  }

  return seen
    .map((drug) => formulary.find((m) => m.drug === drug))
    .filter((m): m is MedicineOption => Boolean(m))
    .slice(0, limit);
}

/* ------------------------------------------------------------------ *
 * Care gaps
 * ------------------------------------------------------------------ */

export type FollowUpGap = {
  patient: Patient;
  lastVisit: Visit;
  drug: string;
  ongoingSince: string;
  daysSinceLastVisit: number;
};

/** The same finding, for one patient, without repeating who they are. */
export type FollowUpStatus = Omit<FollowUpGap, "patient">;

/**
 * Whether one patient has fallen out of contact while on a repeat medicine.
 *
 * "Overdue" here means two things at once, and both are required: there is an
 * open-ended prescription on record — no stop date, so the long-term case —
 * and the last visit was more than `thresholdDays` ago. A five-day antibiotic
 * course finishing is not a care gap, and neither is a long-term patient who
 * came in last week.
 *
 * This reports an attendance gap and nothing more. It says nothing about
 * whether the gap matters for a given patient, does not infer a diagnosis, and
 * makes no clinical recommendation. Someone stable on a repeat prescription
 * and someone who has stopped taking it look identical from here; only the
 * clinician can tell them apart.
 *
 * Returns null when there is nothing to report, so a caller can treat the
 * presence of a result as the finding itself.
 */
export function followUpStatus(
  patient: Patient,
  visits: Visit[],
  thresholdDays = 90,
  asOf: Date = new Date(),
): FollowUpStatus | null {
  const theirs = visitsForPatient(visits, patient.id);
  if (theirs.length === 0) return null;

  // Open-ended prescriptions only, oldest first — the answer to "since when"
  // is when the repeat started, not when it was last reissued.
  const ongoing = theirs
    .flatMap((v) =>
      v.prescriptions
        .filter((p) => p.durationDays === null)
        .map((prescription) => ({ prescription, visit: v })),
    )
    .sort((a, b) => a.visit.date.localeCompare(b.visit.date));
  if (ongoing.length === 0) return null;

  const lastVisit = [...theirs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const daysSinceLastVisit = Math.floor(
    (asOf.getTime() - new Date(lastVisit.date).getTime()) / 86_400_000,
  );
  if (daysSinceLastVisit < thresholdDays) return null;

  return {
    lastVisit,
    drug: ongoing[0].prescription.drug,
    ongoingSince: ongoing[0].visit.date,
    daysSinceLastVisit,
  };
}

/**
 * Every patient at one facility with an open follow-up gap, worst first.
 *
 * A thin wrapper over followUpStatus on purpose: the worklist and the badge on
 * a patient's record have to agree about who is overdue, and the surest way to
 * guarantee that is for them to be the same function. Two implementations of
 * "overdue" would drift, and the drift would show up as a patient flagged on
 * one screen and not the other.
 */
export function overdueFollowUps(
  patients: Patient[],
  visits: Visit[],
  facility: string,
  thresholdDays = 90,
  asOf: Date = new Date(),
): FollowUpGap[] {
  return patients
    .filter((p) => p.facility === facility)
    .flatMap((patient) => {
      const status = followUpStatus(patient, visits, thresholdDays, asOf);
      return status ? [{ patient, ...status }] : [];
    })
    .sort((a, b) => b.daysSinceLastVisit - a.daysSinceLastVisit);
}

/** Diagnosis text already used at this facility, for typeahead only. */
export function pastDiagnosesAt(visits: Visit[], facility: string): string[] {
  const seen = new Set<string>();
  for (const v of visits) {
    if (v.facility === facility) seen.add(v.diagnosis);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}


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
  return `${p.drug} ${p.strength}`;
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
      changes.push({ kind: "started", label: p.drug, detail: `${p.strength} · ${formatFrequency(p.frequency)}` });
    }
  }
  for (const [key, p] of previousDrugs) {
    if (!currentDrugs.has(key)) {
      changes.push({ kind: "stopped", label: p.drug, detail: `${p.strength} · ${formatFrequency(p.frequency)}` });
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
  if (typeof v.systolic !== "number" || typeof v.diastolic !== "number") return "—";
  return `${v.systolic}/${v.diastolic}`;
}
