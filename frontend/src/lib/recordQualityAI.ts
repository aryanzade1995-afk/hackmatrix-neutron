/**
 * AI Record Quality — checks a visit being entered for likely data-entry
 * problems before it is saved.
 *
 * Deterministic rules over the form as it stands and the patient's own earlier
 * visits: plausible ranges, change against recent readings, missing entries,
 * allergy and duplicate-medicine conflicts, and unusual formatting. It flags;
 * it never changes a value, and it never comments on the patient's health —
 * the score is about the record, not the person. The clinician decides.
 */

import type { Allergy, DrugClass, Patient, Visit } from "./demo-data";
import { MEDICINES } from "./formulary";
import type { Prescription } from "./prescribing";

export type VitalKey = "systolic" | "diastolic" | "weightKg" | "heartRate" | "hba1c";

export type QualityField = VitalKey | "diagnosis" | "complaint" | "prescriptions" | "notes" | "patient";

export type IssueType =
  | "OUTLIER"
  | "SUDDEN_CHANGE"
  | "MISSING"
  | "DUPLICATE_PATIENT"
  | "ALLERGY_CONFLICT"
  | "DUPLICATE_MEDICINE"
  | "FORMAT";

export type Severity = "critical" | "warning" | "info";

export type QualityIssue = {
  /** Stable for the same problem on the same value, so a dismissal sticks. */
  id: string;
  type: IssueType;
  severity: Severity;
  field: QualityField;
  /** Short label for the field, as the clinician sees it. */
  fieldLabel: string;
  message: string;
  explanation: string;
};

export type QualityStatus = "GOOD" | "REVIEW" | "ATTENTION";

export type QualityCheck = { label: string; ok: boolean; detail: string };

export type QualityResult = {
  score: number;
  status: QualityStatus;
  issues: QualityIssue[];
  checks: QualityCheck[];
};

export type QualityInput = {
  vitals: Record<VitalKey, string>;
  diagnosis: string;
  complaintLabel: string | null;
  prescriptions: Prescription[];
  notes: string;
  patient: Patient;
  /** This patient's earlier visits, any order. */
  history: Visit[];
  allergies: Allergy[];
  /** Every other patient on file, for the duplicate-record check. */
  otherPatients: Patient[];
};

// ---------------------------------------------------------------------------
// Reference values
// ---------------------------------------------------------------------------

const VITALS: Record<VitalKey, { label: string; unit: string; min: number; max: number }> = {
  systolic: { label: "Systolic BP", unit: "mmHg", min: 70, max: 230 },
  diastolic: { label: "Diastolic BP", unit: "mmHg", min: 40, max: 140 },
  weightKg: { label: "Weight", unit: "kg", min: 2, max: 250 },
  heartRate: { label: "Heart rate", unit: "bpm", min: 35, max: 200 },
  hba1c: { label: "HbA1c", unit: "%", min: 3.5, max: 18 },
};

/** Drug-name stems mapped to the allergy classes the record uses. Catches a
 *  medicine typed by hand, which carries no class of its own. */
const NAME_CLASS: [RegExp, DrugClass][] = [
  [/amoxi|ampi|penicillin|cloxa|flucloxa|piperacillin|augmentin/i, "penicillin"],
  [/azithro|erythro|clarithro|roxithro/i, "macrolide"],
  [/ibuprofen|diclofenac|aspirin|naproxen|ketorolac|mefenamic|aceclofenac/i, "nsaid"],
  [/metformin/i, "biguanide"],
  [/amlodipine|nifedipine|felodipine|cilnidipine/i, "calcium-channel-blocker"],
];

/** Largest ordinary single strength per form, in mg; above it, check the unit. */
const MAX_TABLET_MG = 2000;

const SEVERITY_COST: Record<Severity, number> = { critical: 35, warning: 12, info: 3 };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classOf(p: Prescription): DrugClass | null {
  if (p.drugClass && p.drugClass !== "other") return p.drugClass;
  const known = MEDICINES.find((m) => m.drug.toLowerCase() === p.drug.trim().toLowerCase());
  if (known && known.drugClass !== "other") return known.drugClass;
  return NAME_CLASS.find(([re]) => re.test(p.drug))?.[1] ?? null;
}

function recentValues(history: Visit[], key: VitalKey, n: number): number[] {
  return [...history]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((v) => v.vitals?.[key])
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
    .slice(0, n);
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

export function analyzeRecordQuality(input: QualityInput): QualityResult {
  const issues: QualityIssue[] = [];
  const add = (i: QualityIssue) => {
    if (!issues.some((x) => x.id === i.id)) issues.push(i);
  };

  // --- Vitals: format, range, change against recent readings ---------------
  const parsed: Partial<Record<VitalKey, number>> = {};
  (Object.keys(VITALS) as VitalKey[]).forEach((key) => {
    const raw = input.vitals[key].trim();
    if (!raw) return;
    const ref = VITALS[key];

    if (!/^\d+(\.\d+)?$/.test(raw)) {
      add({
        id: `FORMAT:${key}:${raw}`,
        type: "FORMAT",
        severity: "warning",
        field: key,
        fieldLabel: ref.label,
        message: `"${raw}" is not a plain number`,
        explanation: `Enter ${ref.label.toLowerCase()} as digits only, in ${ref.unit}. Units, letters or spaces are not read as a value.`,
      });
      return;
    }

    const value = Number(raw);
    parsed[key] = value;

    if (value < ref.min || value > ref.max) {
      add({
        id: `OUTLIER:${key}:${raw}`,
        type: "OUTLIER",
        severity: "warning",
        field: key,
        fieldLabel: ref.label,
        message: "Possible data-entry error",
        explanation: `${ref.label} of ${fmt(value)} ${ref.unit} is outside the range usually recorded (${fmt(ref.min)}–${fmt(ref.max)} ${ref.unit}). Please verify the entered value.`,
      });
    }
  });

  if (parsed.systolic !== undefined && parsed.diastolic !== undefined && parsed.diastolic >= parsed.systolic) {
    add({
      id: `FORMAT:bp-order:${parsed.systolic}/${parsed.diastolic}`,
      type: "FORMAT",
      severity: "warning",
      field: "diastolic",
      fieldLabel: "Blood pressure",
      message: "Systolic and diastolic may be swapped",
      explanation: `Diastolic (${fmt(parsed.diastolic)}) is not lower than systolic (${fmt(parsed.systolic)}). Check the two values were entered in the right fields.`,
    });
  }

  // Weight against the most recent recorded weight.
  const lastWeight = recentValues(input.history, "weightKg", 1)[0];
  if (parsed.weightKg !== undefined && lastWeight !== undefined) {
    const change = parsed.weightKg - lastWeight;
    if (Math.abs(change) >= 8 && Math.abs(change) / lastWeight >= 0.15) {
      add({
        id: `SUDDEN_CHANGE:weightKg:${parsed.weightKg}`,
        type: "SUDDEN_CHANGE",
        severity: "warning",
        field: "weightKg",
        fieldLabel: "Weight",
        message: `Weight ${change > 0 ? "increased" : "decreased"} from ${fmt(lastWeight)} kg to ${fmt(parsed.weightKg)} kg`,
        explanation: "That is a large change since the last recorded visit. Please verify the entered value.",
      });
    }
  }

  // Blood pressure against the mean of recent readings.
  const recentSys = recentValues(input.history, "systolic", 3);
  const recentDia = recentValues(input.history, "diastolic", 3);
  if (parsed.systolic !== undefined && recentSys.length >= 2) {
    const sysGap = parsed.systolic - mean(recentSys);
    const diaGap = parsed.diastolic !== undefined && recentDia.length >= 2 ? parsed.diastolic - mean(recentDia) : 0;
    if (Math.abs(sysGap) >= 40 || Math.abs(diaGap) >= 25) {
      const recent = recentSys
        .map((s, i) => (recentDia[i] !== undefined ? `${fmt(s)}/${fmt(recentDia[i])}` : fmt(s)))
        .join(", ");
      add({
        id: `SUDDEN_CHANGE:bp:${parsed.systolic}/${parsed.diastolic ?? ""}`,
        type: "SUDDEN_CHANGE",
        severity: "warning",
        field: "systolic",
        fieldLabel: "Blood pressure",
        message: "Unusual value detected",
        explanation: `Current blood pressure differs significantly from recent records (${recent}). Please verify the reading.`,
      });
    }
  }

  // HbA1c against the most recent value.
  const lastA1c = recentValues(input.history, "hba1c", 1)[0];
  if (parsed.hba1c !== undefined && lastA1c !== undefined && Math.abs(parsed.hba1c - lastA1c) >= 3) {
    add({
      id: `SUDDEN_CHANGE:hba1c:${parsed.hba1c}`,
      type: "SUDDEN_CHANGE",
      severity: "warning",
      field: "hba1c",
      fieldLabel: "HbA1c",
      message: `HbA1c changed from ${fmt(lastA1c)}% to ${fmt(parsed.hba1c)}%`,
      explanation: "A change this large between visits is uncommon. Please verify the entered value.",
    });
  }

  // One message per mistake: a typo like 680 kg is both out of range and a
  // big change, and should read as a single "possible data-entry error".
  const take = (id: string) => {
    const i = issues.findIndex((x) => x.id === id);
    return i >= 0 ? issues.splice(i, 1)[0] : undefined;
  };
  const weightOutlier = issues.find((x) => x.type === "OUTLIER" && x.field === "weightKg");
  const weightChange = issues.find((x) => x.type === "SUDDEN_CHANGE" && x.field === "weightKg");
  if (weightOutlier && weightChange) {
    take(weightChange.id);
    weightOutlier.explanation = `${weightChange.message}. ${weightOutlier.explanation}`;
  }
  const bpChange = issues.find((x) => x.type === "SUDDEN_CHANGE" && x.fieldLabel === "Blood pressure");
  if (bpChange) {
    const sysOut = issues.find((x) => x.type === "OUTLIER" && x.field === "systolic");
    const diaOut = issues.find((x) => x.type === "OUTLIER" && x.field === "diastolic");
    if (sysOut || diaOut) {
      if (sysOut) take(sysOut.id);
      if (diaOut) take(diaOut.id);
      bpChange.explanation += " The reading is also outside the range usually recorded.";
    }
  }

  // --- Missing information ----------------------------------------------------
  if (!input.complaintLabel) {
    add({
      id: "MISSING:complaint",
      type: "MISSING",
      severity: "warning",
      field: "complaint",
      fieldLabel: "Complaint",
      message: "No presenting complaint selected",
      explanation: "The record will not say why the patient came in. Choose a complaint, or 'Other'.",
    });
  }
  if (!input.diagnosis.trim()) {
    add({
      id: "MISSING:diagnosis",
      type: "MISSING",
      severity: "warning",
      field: "diagnosis",
      fieldLabel: "Diagnosis",
      message: "Diagnosis not entered",
      explanation: "A visit cannot be saved without the clinician's assessment.",
    });
  }
  const conditions = input.patient.conditions.map((c) => c.toLowerCase());
  if (conditions.some((c) => c.includes("hypertension")) && parsed.systolic === undefined) {
    add({
      id: "MISSING:bp",
      type: "MISSING",
      severity: "info",
      field: "systolic",
      fieldLabel: "Blood pressure",
      message: "Blood pressure not recorded",
      explanation: "The record lists hypertension, and most visits for this patient include a reading.",
    });
  }
  const anyVital = Object.values(input.vitals).some((v) => v.trim() !== "");
  if (!anyVital) {
    add({
      id: "MISSING:vitals",
      type: "MISSING",
      severity: "info",
      field: "weightKg",
      fieldLabel: "Vitals",
      message: "No vitals recorded for this visit",
      explanation: "Vitals help the next clinician see change over time. Add any that were measured.",
    });
  }

  // --- Prescriptions -----------------------------------------------------------
  input.prescriptions.forEach((p) => {
    const cls = classOf(p);
    const allergy = cls ? input.allergies.find((a) => a.drugClass === cls) : undefined;
    if (allergy) {
      add({
        id: `ALLERGY_CONFLICT:${p.drug.toLowerCase()}:${allergy.drugClass}`,
        type: "ALLERGY_CONFLICT",
        severity: "critical",
        field: "prescriptions",
        fieldLabel: p.drug,
        message: "Allergy conflict",
        explanation: `${p.drug} may conflict with a recorded ${allergy.label.toLowerCase()} allergy. Clinician verification required.`,
      });
    }

    const mg = /^(\d+(?:\.\d+)?)\s*mg$/i.exec(p.strength.trim());
    if (/^\d+(\.\d+)?$/.test(p.strength.trim())) {
      add({
        id: `FORMAT:strength-unit:${p.drug}:${p.strength}`,
        type: "FORMAT",
        severity: "warning",
        field: "prescriptions",
        fieldLabel: p.drug,
        message: "Strength has no unit",
        explanation: `"${p.strength}" does not say mg, ml or another unit. Add the unit so the dose cannot be misread.`,
      });
    } else if (mg && (p.form === "Tablet" || p.form === "Capsule") && Number(mg[1]) > MAX_TABLET_MG) {
      add({
        id: `FORMAT:strength-size:${p.drug}:${p.strength}`,
        type: "FORMAT",
        severity: "warning",
        field: "prescriptions",
        fieldLabel: p.drug,
        message: "Unusually large strength",
        explanation: `${p.strength} per ${p.form.toLowerCase()} is above the usual range. Check for an extra zero or a unit mix-up.`,
      });
    }
  });

  // Same medicine, or two from the same drug class.
  for (let i = 0; i < input.prescriptions.length; i++) {
    for (let j = i + 1; j < input.prescriptions.length; j++) {
      const a = input.prescriptions[i];
      const b = input.prescriptions[j];
      const sameName = a.drug.trim().toLowerCase() === b.drug.trim().toLowerCase();
      const ca = classOf(a);
      const sameClass = !sameName && ca !== null && ca === classOf(b);
      if (sameName || sameClass) {
        add({
          id: `DUPLICATE_MEDICINE:${[a.drug, b.drug].map((d) => d.toLowerCase()).sort().join("+")}`,
          type: "DUPLICATE_MEDICINE",
          severity: "warning",
          field: "prescriptions",
          fieldLabel: sameName ? a.drug : `${a.drug} + ${b.drug}`,
          message: sameName ? "Medicine listed twice" : "Two medicines from the same class",
          explanation: sameName
            ? `${a.drug} appears more than once on this prescription. Remove the extra line if it was added by mistake.`
            : `${a.drug} and ${b.drug} belong to the same drug class. Confirm both are intended.`,
        });
      }
    }
  }

  // --- Possible duplicate patient record -------------------------------------
  const name = input.patient.name.trim().toLowerCase();
  const phone = (input.patient.phone ?? "").replace(/\D/g, "");
  const twin = input.otherPatients.find(
    (o) =>
      o.id !== input.patient.id &&
      ((o.name.trim().toLowerCase() === name && o.dob === input.patient.dob) ||
        (phone.length >= 8 && (o.phone ?? "").replace(/\D/g, "") === phone)),
  );
  if (twin) {
    add({
      id: `DUPLICATE_PATIENT:${twin.id}`,
      type: "DUPLICATE_PATIENT",
      severity: "warning",
      field: "patient",
      fieldLabel: "Patient record",
      message: "Possible duplicate patient",
      explanation: `${twin.id} (${twin.name}) has the same ${
        twin.dob === input.patient.dob && twin.name.trim().toLowerCase() === name ? "name and date of birth" : "phone number"
      }. Check this visit is being added to the right record.`,
    });
  }

  // --- Score and summary -------------------------------------------------------
  return summarise(issues, input);
}

/** Score, status and checklist for a set of issues (used again after dismissals). */
export function summarise(issues: QualityIssue[], input: Pick<QualityInput, "prescriptions">): QualityResult {
  const order: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
  const sorted = [...issues].sort((a, b) => order[a.severity] - order[b.severity]);

  let score = 100 - sorted.reduce((s, i) => s + SEVERITY_COST[i.severity], 0);
  const critical = sorted.some((i) => i.severity === "critical");
  // Any critical conflict needs attention, whatever else is right.
  if (critical) score = Math.min(score, 69);
  score = Math.max(0, Math.min(100, score));

  const status: QualityStatus = critical || score < 70 ? "ATTENTION" : score < 90 ? "REVIEW" : "GOOD";

  const count = (pred: (i: QualityIssue) => boolean) => sorted.filter(pred).length;
  const vitalIssues = count((i) => ["systolic", "diastolic", "weightKg", "heartRate", "hba1c"].includes(i.field) && i.severity !== "info");
  const rxIssues = count((i) => i.field === "prescriptions" && i.type !== "ALLERGY_CONFLICT");
  const allergyIssues = count((i) => i.type === "ALLERGY_CONFLICT");
  const missing = count((i) => i.type === "MISSING");
  const dupPatient = count((i) => i.type === "DUPLICATE_PATIENT");

  const checks: QualityCheck[] = [
    {
      label: "Vitals",
      ok: vitalIssues === 0,
      detail: vitalIssues === 0 ? "Vitals consistent" : `${vitalIssues} ${vitalIssues === 1 ? "value needs" : "values need"} verification`,
    },
    {
      label: "Prescription",
      ok: rxIssues === 0,
      detail:
        input.prescriptions.length === 0
          ? "No medicines prescribed"
          : rxIssues === 0
            ? "Prescription complete"
            : `${rxIssues} prescription ${rxIssues === 1 ? "line needs" : "lines need"} review`,
    },
    {
      label: "Allergies",
      ok: allergyIssues === 0,
      detail: allergyIssues === 0 ? "No allergy conflicts" : `${allergyIssues} allergy ${allergyIssues === 1 ? "conflict" : "conflicts"}`,
    },
    {
      label: "Completeness",
      ok: missing === 0,
      detail: missing === 0 ? "Key fields filled" : `${missing} ${missing === 1 ? "item" : "items"} missing`,
    },
    {
      label: "Identity",
      ok: dupPatient === 0,
      detail: dupPatient === 0 ? "No duplicate record found" : "Possible duplicate record",
    },
  ];

  return { score, status, issues: sorted, checks };
}
