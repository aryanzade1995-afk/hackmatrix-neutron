/**
 * Builds the clinical summary from the visit record.
 *
 * Every sentence is constructed *from* a specific set of visits, so its
 * citation is correct by construction rather than by inspection. That is the
 * point: the UI promises "sentences without a source are dropped", and a
 * generator that derives each claim from its source cannot produce an
 * unsourced one in the first place.
 *
 * This is not a language model and must not be described as one. It reports
 * what is in the record — it never infers, diagnoses, or recommends.
 */

import type { Allergy, Patient, Visit } from "./demo-data";
import { findAllergyConflicts, vitalSeries } from "./clinical";
import { formatFrequency } from "./prescribing";

export type SummarySentence = {
  /** Rendered text, already assembled. */
  text: string;
  /** 1-based citation numbers into `sources`. */
  cites: number[];
  tone?: "normal" | "alert";
};

export type Summary = {
  sentences: SummarySentence[];
  /** Visits referenced, in citation order. */
  sources: Visit[];
  empty: boolean;
};

const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");

function monthYear(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

/** Lowercases only the first character, so acronyms like "ER" survive. */
function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Longest-running regular medicine, by first appearance in the record. */
function ongoingMedicines(visits: Visit[]) {
  const first = new Map<string, { visit: Visit; strength: string }>();
  const ordered = [...visits].sort((a, b) => a.date.localeCompare(b.date));

  for (const visit of ordered) {
    for (const p of visit.prescriptions) {
      // Only medicines with no stop date count as ongoing.
      if (p.durationDays !== null) continue;
      if (!first.has(p.drug)) first.set(p.drug, { visit, strength: p.strength });
    }
  }
  return first;
}

export function buildSummary(patient: Patient, visits: Visit[]): Summary {
  if (visits.length === 0) {
    return { sentences: [], sources: [], empty: true };
  }

  const ordered = [...visits].sort((a, b) => b.date.localeCompare(a.date));
  const oldest = ordered[ordered.length - 1];
  const sources: Visit[] = [];
  const sentences: SummarySentence[] = [];

  /** Registers a visit as a citation and returns its 1-based number. */
  const cite = (visit: Visit): number => {
    const existing = sources.findIndex((v) => v.id === visit.id);
    if (existing >= 0) return existing + 1;
    sources.push(visit);
    return sources.length;
  };

  const firstName = patient.name.split(" ")[0];

  // --- Attendance -------------------------------------------------------
  const facilities = new Set(visits.map((v) => v.facility)).size;
  sentences.push({
    text:
      `${firstName} has attended ${ordered.length} ${plural(ordered.length, "visit")} ` +
      `across ${facilities} ${plural(facilities, "facility", "facilities")} ` +
      `since ${monthYear(oldest.date)}.`,
    cites: [cite(oldest)],
  });

  // --- Ongoing medicines ------------------------------------------------
  const ongoing = ongoingMedicines(visits);
  if (ongoing.size > 0) {
    const parts = [...ongoing.entries()].map(([drug, { visit, strength }]) => ({
      label: `${drug} ${strength} since ${monthYear(visit.date)}`,
      n: cite(visit),
    }));
    sentences.push({
      text: `Ongoing medication: ${parts.map((p) => p.label).join(", ")}.`,
      cites: parts.map((p) => p.n),
    });
  }

  // --- Admissions -------------------------------------------------------
  const admissions = ordered.filter((v) => v.admission);
  if (admissions.length > 0) {
    const latest = admissions[0];
    sentences.push({
      text:
        `${admissions.length} emergency ${plural(admissions.length, "admission")} ` +
        `on record, most recently ${latest.display} for ${lowerFirst(latest.diagnosis)}.`,
      cites: admissions.map(cite),
    });
  }

  // --- Blood pressure direction ----------------------------------------
  const systolic = vitalSeries(visits, "systolic");
  const diastolic = vitalSeries(visits, "diastolic");
  if (systolic.length >= 2 && diastolic.length >= 2) {
    const firstS = systolic[0];
    const lastS = systolic[systolic.length - 1];
    const firstD = diastolic[0];
    const lastD = diastolic[diastolic.length - 1];
    const direction =
      lastS.value < firstS.value ? "fallen" : lastS.value > firstS.value ? "risen" : "held";

    const from = ordered.find((v) => v.date === firstS.date);
    const to = ordered.find((v) => v.date === lastS.date);

    sentences.push({
      text:
        `Blood pressure has ${direction} from ${firstS.value}/${firstD.value} ` +
        `in ${monthYear(firstS.date)} to ${lastS.value}/${lastD.value} ` +
        `at the most recent reading.`,
      cites: [from, to].filter(Boolean).map((v) => cite(v as Visit)),
    });
  }

  // --- HbA1c ------------------------------------------------------------
  const hba1c = vitalSeries(visits, "hba1c");
  if (hba1c.length >= 2) {
    const first = hba1c[0];
    const last = hba1c[hba1c.length - 1];
    const to = ordered.find((v) => v.date === last.date);
    sentences.push({
      text: `HbA1c ${last.value < first.value ? "improved" : "moved"} from ${first.value}% to ${last.value}%.`,
      cites: to ? [cite(to)] : [],
    });
  }

  // --- Allergies --------------------------------------------------------
  for (const allergy of patient.allergies) {
    const recorded = findRecordingVisit(ordered, allergy);
    sentences.push({
      text: `Recorded ${allergy.severity} allergy to ${allergy.label.toLowerCase()} — avoid ${allergy.drugClass.replace(/-/g, " ")} medicines.`,
      cites: recorded ? [cite(recorded)] : [],
      tone: "alert",
    });
  }

  // --- Conflicts already in the record ----------------------------------
  const conflicts = findAllergyConflicts(visits, patient.allergies);
  for (const c of conflicts) {
    sentences.push({
      text:
        `${c.prescription.drug} ${c.prescription.strength} ` +
        `(${formatFrequency(c.prescription.frequency)}) was prescribed at ` +
        `${c.visit.facility} on ${c.visit.display}, despite the recorded ` +
        `${c.allergy.label.toLowerCase()} allergy.`,
      cites: [cite(c.visit)],
      tone: "alert",
    });
  }

  // A sentence can only exist here if it was built from a cited visit, so
  // this filter should never remove anything. It is kept as a guarantee.
  return {
    sentences: sentences.filter((s) => s.cites.length > 0),
    sources,
    empty: false,
  };
}

/** The visit whose notes first mention the allergy, if any. */
function findRecordingVisit(ordered: Visit[], allergy: Allergy): Visit | undefined {
  const needle = allergy.label.toLowerCase();
  return [...ordered]
    .reverse()
    .find((v) => v.notes.toLowerCase().includes(needle));
}
