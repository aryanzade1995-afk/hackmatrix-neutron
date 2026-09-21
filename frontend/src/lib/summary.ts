/**
 * Builds summaries from the visit record.
 *
 * Split into two halves deliberately:
 *
 *   computeSummaryFacts()   reads the record and works out what is true
 *   buildSummary()          says it to a clinician, with citations
 *   renderPatientSummary()  says the same things to the patient, in plain words
 *
 * Both renderers draw on one set of facts, so the two summaries cannot drift
 * apart and disagree about the same record. Adding a third audience later
 * means writing a renderer, not recomputing anything.
 *
 * Neither renderer is a language model and neither should be described as one.
 * They report what is in the record and never infer, diagnose or recommend.
 */

import type { Allergy, Patient, Prescription, Visit } from "./demo-data";
import { findAllergyConflicts, vitalSeries, type Conflict } from "./clinical";
import { formatFrequency, plainFood, plainFrequency } from "./prescribing";

/* ------------------------------------------------------------------ *
 * Facts
 * ------------------------------------------------------------------ */

export type OngoingMedicine = {
  drug: string;
  strength: string;
  prescription: Prescription;
  visit: Visit;
};

export type BpMovement = {
  fromValue: string;
  toValue: string;
  fromVisit: Visit;
  toVisit: Visit;
  fromDate: string;
  direction: "fallen" | "risen" | "held";
};

export type SummaryFacts = {
  patient: Patient;
  visitCount: number;
  facilityCount: number;
  oldest: Visit;
  ordered: Visit[];
  ongoing: OngoingMedicine[];
  admissions: Visit[];
  bp: BpMovement | null;
  hba1c: { from: number; to: number; toVisit: Visit } | null;
  allergies: { allergy: Allergy; recordedAt: Visit | undefined }[];
  conflicts: Conflict[];
};

export function computeSummaryFacts(
  patient: Patient,
  visits: Visit[],
): SummaryFacts | null {
  if (visits.length === 0) return null;

  const ordered = [...visits].sort((a, b) => b.date.localeCompare(a.date));
  const oldest = ordered[ordered.length - 1];

  // --- Ongoing medicines: open-ended only, earliest appearance wins -------
  const firstSeen = new Map<string, OngoingMedicine>();
  for (const visit of [...visits].sort((a, b) => a.date.localeCompare(b.date))) {
    for (const p of visit.prescriptions) {
      if (p.durationDays !== null) continue; // a finished course is not ongoing
      if (!firstSeen.has(p.drug)) {
        firstSeen.set(p.drug, {
          drug: p.drug,
          strength: p.strength,
          prescription: p,
          visit,
        });
      }
    }
  }

  // --- Blood pressure -----------------------------------------------------
  const systolic = vitalSeries(visits, "systolic");
  const diastolic = vitalSeries(visits, "diastolic");
  let bp: BpMovement | null = null;
  if (systolic.length >= 2 && diastolic.length >= 2) {
    const firstS = systolic[0];
    const lastS = systolic[systolic.length - 1];
    const firstD = diastolic[0];
    const lastD = diastolic[diastolic.length - 1];
    const fromVisit = ordered.find((v) => v.date === firstS.date);
    const toVisit = ordered.find((v) => v.date === lastS.date);

    if (fromVisit && toVisit) {
      bp = {
        fromValue: `${firstS.value}/${firstD.value}`,
        toValue: `${lastS.value}/${lastD.value}`,
        fromVisit,
        toVisit,
        fromDate: firstS.date,
        direction:
          lastS.value < firstS.value
            ? "fallen"
            : lastS.value > firstS.value
              ? "risen"
              : "held",
      };
    }
  }

  // --- HbA1c --------------------------------------------------------------
  const hba1cSeries = vitalSeries(visits, "hba1c");
  let hba1c: SummaryFacts["hba1c"] = null;
  if (hba1cSeries.length >= 2) {
    const first = hba1cSeries[0];
    const last = hba1cSeries[hba1cSeries.length - 1];
    const toVisit = ordered.find((v) => v.date === last.date);
    if (toVisit) hba1c = { from: first.value, to: last.value, toVisit };
  }

  return {
    patient,
    visitCount: ordered.length,
    facilityCount: new Set(visits.map((v) => v.facility)).size,
    oldest,
    ordered,
    ongoing: [...firstSeen.values()],
    admissions: ordered.filter((v) => v.admission),
    bp,
    hba1c,
    allergies: patient.allergies.map((allergy) => ({
      allergy,
      recordedAt: findRecordingVisit(ordered, allergy),
    })),
    conflicts: findAllergyConflicts(visits, patient.allergies),
  };
}

/* ------------------------------------------------------------------ *
 * Clinical renderer — unchanged output, now reading from facts
 * ------------------------------------------------------------------ */

export type SummarySentence = {
  text: string;
  /** 1-based citation numbers into `sources`. */
  cites: number[];
  tone?: "normal" | "alert";
};

export type Summary = {
  sentences: SummarySentence[];
  sources: Visit[];
  empty: boolean;
};

export function buildSummary(patient: Patient, visits: Visit[]): Summary {
  const facts = computeSummaryFacts(patient, visits);
  if (!facts) return { sentences: [], sources: [], empty: true };

  const sources: Visit[] = [];
  const sentences: SummarySentence[] = [];

  /** Registers a visit as a citation and returns its 1-based number. */
  const cite = (visit: Visit): number => {
    const existing = sources.findIndex((v) => v.id === visit.id);
    if (existing >= 0) return existing + 1;
    sources.push(visit);
    return sources.length;
  };

  const firstName = facts.patient.name.split(" ")[0];

  sentences.push({
    text:
      `${firstName} has attended ${facts.visitCount} ${plural(facts.visitCount, "visit")} ` +
      `across ${facts.facilityCount} ${plural(facts.facilityCount, "facility", "facilities")} ` +
      `since ${monthYear(facts.oldest.date)}.`,
    cites: [cite(facts.oldest)],
  });

  if (facts.ongoing.length > 0) {
    const parts = facts.ongoing.map((m) => ({
      label: `${m.drug} ${m.strength} since ${monthYear(m.visit.date)}`,
      n: cite(m.visit),
    }));
    sentences.push({
      text: `Ongoing medication: ${parts.map((p) => p.label).join(", ")}.`,
      cites: parts.map((p) => p.n),
    });
  }

  if (facts.admissions.length > 0) {
    const latest = facts.admissions[0];
    sentences.push({
      text:
        `${facts.admissions.length} emergency ${plural(facts.admissions.length, "admission")} ` +
        `on record, most recently ${latest.display} for ${lowerFirst(latest.diagnosis)}.`,
      cites: facts.admissions.map(cite),
    });
  }

  if (facts.bp) {
    sentences.push({
      text:
        `Blood pressure has ${facts.bp.direction} from ${facts.bp.fromValue} ` +
        `in ${monthYear(facts.bp.fromDate)} to ${facts.bp.toValue} ` +
        `at the most recent reading.`,
      cites: [cite(facts.bp.fromVisit), cite(facts.bp.toVisit)],
    });
  }

  if (facts.hba1c) {
    sentences.push({
      text: `HbA1c ${facts.hba1c.to < facts.hba1c.from ? "improved" : "moved"} from ${facts.hba1c.from}% to ${facts.hba1c.to}%.`,
      cites: [cite(facts.hba1c.toVisit)],
    });
  }

  for (const { allergy, recordedAt } of facts.allergies) {
    sentences.push({
      text: `Recorded ${allergy.severity} allergy to ${allergy.label.toLowerCase()} — avoid ${allergy.drugClass.replace(/-/g, " ")} medicines.`,
      cites: recordedAt ? [cite(recordedAt)] : [],
      tone: "alert",
    });
  }

  for (const c of facts.conflicts) {
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

/* ------------------------------------------------------------------ *
 * Patient renderer — same facts, second person, no jargon
 * ------------------------------------------------------------------ */

export type PatientSummary = {
  empty: boolean;
  greeting: string;
  paragraphs: string[];
  medicines: { line: string; detail: string }[];
  allergyWarnings: string[];
  disclaimer: string;
};

export function renderPatientSummary(facts: SummaryFacts | null): PatientSummary {
  const disclaimer =
    "This is a plain-language summary of your own health record, put together " +
    "automatically from your past visits. It does not replace advice from your doctor.";

  if (!facts) {
    return {
      empty: true,
      greeting: "",
      paragraphs: [],
      medicines: [],
      allergyWarnings: [],
      disclaimer,
    };
  }

  const paragraphs: string[] = [];

  paragraphs.push(
    `You have been seen ${facts.visitCount} ${facts.visitCount === 1 ? "time" : "times"} ` +
      `at ${facts.facilityCount} ${facts.facilityCount === 1 ? "clinic" : "clinics"} ` +
      `since ${monthYear(facts.oldest.date)}.`,
  );

  if (facts.bp) {
    if (facts.bp.direction === "fallen") {
      paragraphs.push(
        `Your blood pressure has come down since your earlier visits — from ` +
          `${facts.bp.fromValue} to ${facts.bp.toValue}. That is a good sign.`,
      );
    } else if (facts.bp.direction === "risen") {
      paragraphs.push(
        `Your blood pressure has gone up since your earlier visits — from ` +
          `${facts.bp.fromValue} to ${facts.bp.toValue}. Your doctor will want to keep an eye on this.`,
      );
    } else {
      paragraphs.push(`Your blood pressure has stayed about the same.`);
    }
  }

  if (facts.hba1c) {
    paragraphs.push(
      facts.hba1c.to < facts.hba1c.from
        ? "Your blood sugar level has improved since it was last checked."
        : "Your blood sugar level has changed since it was last checked — worth asking your doctor about.",
    );
  }

  if (facts.admissions.length > 0) {
    paragraphs.push(
      `You have been admitted as an emergency ` +
        `${facts.admissions.length === 1 ? "once" : `${facts.admissions.length} times`}. ` +
        `Your care team has the details on file.`,
    );
  }

  const medicines = facts.ongoing.map((m) => {
    const when = plainFrequency(m.prescription.frequency);
    // "once a day, in the morning, any time of day" contradicts itself. When
    // food timing carries no instruction, say nothing rather than filler.
    const food =
      m.prescription.food === "Any time" ? null : plainFood(m.prescription.food);
    return {
      line: `${m.drug} ${m.strength}`,
      detail: food ? `${when}, ${food}` : when,
    };
  });

  const allergyWarnings = facts.allergies.map(
    ({ allergy }) =>
      `Your record says you react badly to ${allergy.label.toLowerCase()}. ` +
      `Always mention this before you are given a new medicine.`,
  );

  return {
    empty: false,
    greeting: `Hello, ${facts.patient.name.split(" ")[0]}`,
    paragraphs,
    medicines,
    allergyWarnings,
    disclaimer,
  };
}

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

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

/** The visit whose notes first mention the allergy, if any. */
function findRecordingVisit(ordered: Visit[], allergy: Allergy): Visit | undefined {
  const needle = allergy.label.toLowerCase();
  return [...ordered].reverse().find((v) => v.notes.toLowerCase().includes(needle));
}
