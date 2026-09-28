/**
 * Voice entry — sample dictations and the mapping from a reviewed draft onto
 * the existing New Visit form.
 *
 * Transcription and extraction are simulated in the browser: each recording
 * is matched to one of the sample dictations below, which carry both the
 * transcript and the structured draft that would be extracted from it. No
 * audio leaves the device and nothing here calls a server.
 *
 * The draft is never saved directly. It is shown to the clinician field by
 * field, every field editable, and only "Apply to Visit Form" copies it into
 * the ordinary form — where the usual review and Save visit step still apply.
 */

import { chiefComplaints } from "./demo-data";
import { MEDICINES, type FoodTiming, type Frequency } from "./formulary";
import { quantityFor, type Prescription } from "./prescribing";

export const FREQUENCY_OPTIONS = [
  "Once daily",
  "Once daily at night",
  "Twice daily",
  "Three times daily",
  "As needed",
] as const;
export type FrequencyWords = (typeof FREQUENCY_OPTIONS)[number];

export const FOOD_OPTIONS: FoodTiming[] = ["After food", "Before food", "With food", "Any time"];

export type DraftMedicine = {
  drug: string;
  dose: string;
  frequency: FrequencyWords;
  instructions: FoodTiming;
  /** "3 days", or "Ongoing" for a continued long-term medicine. */
  duration: string;
};

export type VoiceDraft = {
  /** Existing complaint category the visit is filed under. */
  complaintId: string;
  /** The complaint in the clinician's own words. */
  complaint: string;
  complaintDuration: string;
  temperatureF: string;
  bloodPressure: string;
  heartRate: string;
  diagnosis: string;
  medicines: DraftMedicine[];
  notes: string;
};

export type VoiceScenario = {
  id: string;
  title: string;
  /** Seconds the sample recording lasts, for the timer. */
  seconds: number;
  transcript: string;
  draft: VoiceDraft;
};

export const VOICE_SCENARIOS: VoiceScenario[] = [
  {
    id: "fever",
    title: "Fever and headache",
    seconds: 14,
    transcript:
      "Patient has fever and headache for three days. Temperature is 101.2 Fahrenheit. " +
      "Diagnosis is viral fever. Prescribe paracetamol 500 milligrams twice daily after food " +
      "for three days.",
    draft: {
      complaintId: "fever",
      complaint: "Fever, headache",
      complaintDuration: "3 days",
      temperatureF: "101.2",
      bloodPressure: "",
      heartRate: "",
      diagnosis: "Viral fever",
      medicines: [
        {
          drug: "Paracetamol",
          dose: "500 mg",
          frequency: "Twice daily",
          instructions: "After food",
          duration: "3 days",
        },
      ],
      notes: "",
    },
  },
  {
    id: "throat",
    title: "Cough and sore throat",
    seconds: 17,
    transcript:
      "Dry cough and sore throat for four days, no breathlessness. Temperature 99.8 " +
      "Fahrenheit. Throat is congested. Diagnosis is acute pharyngitis. Give cetirizine " +
      "10 milligrams once daily at night for five days, and paracetamol 650 milligrams " +
      "only if fever. Advise warm saline gargles.",
    draft: {
      complaintId: "cough-cold",
      complaint: "Dry cough, sore throat",
      complaintDuration: "4 days",
      temperatureF: "99.8",
      bloodPressure: "",
      heartRate: "",
      diagnosis: "Acute pharyngitis",
      medicines: [
        {
          drug: "Cetirizine",
          dose: "10 mg",
          frequency: "Once daily at night",
          instructions: "Any time",
          duration: "5 days",
        },
        {
          drug: "Paracetamol",
          dose: "650 mg",
          frequency: "As needed",
          instructions: "After food",
          duration: "3 days",
        },
      ],
      notes: "Throat congested, no breathlessness. Advised warm saline gargles.",
    },
  },
  {
    id: "bp-review",
    title: "Blood pressure follow-up",
    seconds: 15,
    transcript:
      "Follow-up visit for blood pressure. BP today is 138 over 86, pulse 76. " +
      "Patient is taking medicines regularly, no complaints. Diagnosis hypertension, " +
      "controlled. Continue amlodipine 5 milligrams once daily in the morning. Review in one month.",
    draft: {
      complaintId: "follow-up",
      complaint: "Routine blood pressure follow-up",
      complaintDuration: "",
      temperatureF: "",
      bloodPressure: "138/86",
      heartRate: "76",
      diagnosis: "Hypertension, controlled",
      medicines: [
        {
          drug: "Amlodipine",
          dose: "5 mg",
          frequency: "Once daily",
          instructions: "Any time",
          duration: "Ongoing",
        },
      ],
      notes: "Taking medicines regularly, no complaints. Review in one month.",
    },
  },
];

// ---------------------------------------------------------------------------
// Draft → existing form fields
// ---------------------------------------------------------------------------

const FREQUENCIES: Record<FrequencyWords, Frequency> = {
  "Once daily": { morning: 1, afternoon: 0, night: 0 },
  "Once daily at night": { morning: 0, afternoon: 0, night: 1 },
  "Twice daily": { morning: 1, afternoon: 0, night: 1 },
  "Three times daily": { morning: 1, afternoon: 1, night: 1 },
  "As needed": { morning: 0, afternoon: 0, night: 0, asNeeded: true },
};

/** "3 days" → 3, "Ongoing" or blank → null. */
export function daysFrom(text: string): number | null {
  const match = text.match(/\d+/);
  return match ? Math.max(1, Number(match[0])) : null;
}

/** "500 mg" → "500mg", the spelling the formulary and Rx lines use. */
function strengthFrom(dose: string): string {
  return dose.trim().replace(/\s+(mg|ml|mcg|g)\b/gi, "$1") || "As directed";
}

export function prescriptionFrom(m: DraftMedicine): Prescription {
  const known = MEDICINES.find((x) => x.drug.toLowerCase() === m.drug.trim().toLowerCase());
  const frequency = FREQUENCIES[m.frequency];
  const durationDays = /ongoing|continue/i.test(m.duration) ? null : daysFrom(m.duration);
  const form = known?.form ?? "Tablet";
  return {
    drug: known?.drug ?? m.drug.trim(),
    strength: strengthFrom(m.dose),
    form,
    route: known?.route ?? "Oral",
    frequency,
    food: m.instructions,
    durationDays,
    quantity: quantityFor(form, frequency, durationDays),
    // The drug class is what the allergy check reads, so it comes from the
    // formulary rather than from anything spoken.
    drugClass: known?.drugClass ?? "other",
  };
}

/** Duration chip on the complaint's follow-up question. */
function durationChip(text: string): string | null {
  const days = daysFrom(text);
  if (days === null) return null;
  if (days <= 2) return "1-2 days";
  if (days <= 5) return "3-5 days";
  return "5+ days";
}

export type AppliedFields = {
  complaintId: string | null;
  answers: Record<string, string[]>;
  diagnosis: string;
  prescriptions: Prescription[];
  vitals: { systolic: string; diastolic: string; heartRate: string };
  notes: string;
};

/**
 * Maps a reviewed draft onto the form's own state. Anything the form has no
 * field for — the complaint in the clinician's words, the temperature — is
 * written into Notes rather than dropped, so nothing dictated is lost.
 */
export function fieldsFromDraft(draft: VoiceDraft): AppliedFields {
  const complaint = chiefComplaints.find((c) => c.id === draft.complaintId) ?? null;
  const answers: Record<string, string[]> = {};

  if (complaint) {
    const spoken = draft.complaint.toLowerCase();
    for (const q of complaint.followUps) {
      if (q.id === "duration") {
        const chip = durationChip(draft.complaintDuration);
        if (chip && q.options.includes(chip)) answers[q.id] = [chip];
        continue;
      }
      const matched = q.options.filter(
        (opt) => opt !== "None" && spoken.includes(opt.toLowerCase()),
      );
      // Routine follow-up: "blood pressure" in the words picks that reason.
      if (matched.length > 0) answers[q.id] = q.type === "single" ? [matched[0]] : matched;
    }
  }

  const [systolic = "", diastolic = ""] = draft.bloodPressure
    .split(/[/\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const noteLines = [
    draft.complaint.trim() &&
      `${draft.complaint.trim()}${draft.complaintDuration.trim() ? ` for ${draft.complaintDuration.trim()}` : ""}.`,
    draft.temperatureF.trim() && `Temperature ${draft.temperatureF.trim()} °F.`,
    draft.notes.trim(),
  ].filter(Boolean);

  return {
    complaintId: complaint?.id ?? null,
    answers,
    diagnosis: draft.diagnosis.trim(),
    prescriptions: draft.medicines.filter((m) => m.drug.trim()).map(prescriptionFrom),
    vitals: { systolic, diastolic, heartRate: draft.heartRate.trim() },
    notes: noteLines.join(" "),
  };
}

/** Complaint categories offered in the review, from the form's own list. */
export const COMPLAINT_OPTIONS = chiefComplaints.map((c) => ({ id: c.id, label: c.label }));
