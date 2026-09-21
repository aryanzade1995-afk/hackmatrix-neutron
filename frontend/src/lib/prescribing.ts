/**
 * Everything needed to turn a chosen medicine into a dispensable prescription
 * line. Quantity is computed rather than typed — miscounting doses is a real
 * dispensing error, and a doctor should not be doing arithmetic.
 */

import type {
  DoseForm,
  FoodTiming,
  Frequency,
  MedicineOption,
  Route,
} from "./formulary";
import type { DrugClass } from "./demo-data";

export type Prescription = {
  drug: string;
  strength: string;
  form: DoseForm;
  route: Route;
  frequency: Frequency;
  food: FoodTiming;
  /** null means ongoing — a long-term medicine with no stop date */
  durationDays: number | null;
  /** units to dispense, derived from frequency × duration */
  quantity: number;
  drugClass: DrugClass | "other";
  instruction?: string;
};

/* ------------------------------------------------------------------ *
 * Frequency
 * ------------------------------------------------------------------ */

/** "1-0-1" — the notation written on Indian prescriptions. */
export function formatFrequency(f: Frequency): string {
  if (f.asNeeded) return "SOS";
  const part = (n: number) => (n === 0.5 ? "½" : String(n));
  return `${part(f.morning)}-${part(f.afternoon)}-${part(f.night)}`;
}

/** The Latin shorthand the same schedule corresponds to. */
export function frequencyShorthand(f: Frequency): string {
  if (f.asNeeded) return "PRN";
  const slots = [f.morning, f.afternoon, f.night].filter((n) => n > 0).length;
  if (slots === 0) return "—";
  if (slots === 1) {
    if (f.night > 0 && f.morning === 0 && f.afternoon === 0) return "HS";
    return "OD";
  }
  if (slots === 2) return "BD";
  return "TDS";
}

/** The same schedule in words a patient would use, not clinical shorthand. */
export function plainFrequency(f: Frequency): string {
  if (f.asNeeded) return "only when you need it";
  const slots = [f.morning, f.afternoon, f.night].filter((n) => n > 0).length;
  if (slots === 0) return "as directed";
  if (slots === 1) {
    if (f.night > 0) return "once a day, at night";
    if (f.morning > 0) return "once a day, in the morning";
    return "once a day";
  }
  if (slots === 2) return "twice a day";
  return "three times a day";
}

/** "after food" → "after you eat". */
export function plainFood(food: FoodTiming): string {
  switch (food) {
    case "Before food":
      return "before you eat";
    case "After food":
      return "after you eat";
    case "With food":
      return "with your food";
    case "Any time":
      return "any time of day";
  }
}

export function dosesPerDay(f: Frequency): number {
  if (f.asNeeded) return 0;
  return f.morning + f.afternoon + f.night;
}

/* ------------------------------------------------------------------ *
 * Quantity
 * ------------------------------------------------------------------ */

/** Forms dispensed as whole containers rather than counted units. */
const CONTAINER_FORMS: DoseForm[] = ["Syrup", "Inhaler", "Ointment", "Drops"];

export function quantityFor(
  form: DoseForm,
  frequency: Frequency,
  durationDays: number | null,
): number {
  if (CONTAINER_FORMS.includes(form)) return 1;
  if (frequency.asNeeded) return durationDays ? Math.max(durationDays, 1) : 10;
  if (durationDays === null) return 30; // one month supply for ongoing medicines
  return Math.ceil(dosesPerDay(frequency) * durationDays);
}

export function quantityUnit(form: DoseForm, quantity: number): string {
  const plural = quantity === 1 ? "" : "s";
  switch (form) {
    case "Tablet":
      return `tablet${plural}`;
    case "Capsule":
      return `capsule${plural}`;
    case "Sachet":
      return `sachet${plural}`;
    case "Injection":
      return `vial${plural}`;
    case "Syrup":
      return "bottle";
    case "Inhaler":
      return "inhaler";
    case "Ointment":
      return "tube";
    case "Drops":
      return "bottle";
  }
}

/* ------------------------------------------------------------------ *
 * Building and displaying
 * ------------------------------------------------------------------ */

export function buildPrescription(
  medicine: MedicineOption,
  overrides: Partial<
    Pick<Prescription, "strength" | "frequency" | "food" | "durationDays" | "instruction">
  > = {},
): Prescription {
  const strength = overrides.strength ?? medicine.strengths[0];
  const frequency = overrides.frequency ?? medicine.defaultFrequency;
  const food = overrides.food ?? medicine.defaultFood;
  const durationDays =
    overrides.durationDays !== undefined
      ? overrides.durationDays
      : medicine.defaultDurationDays;

  return {
    drug: medicine.drug,
    strength,
    form: medicine.form,
    route: medicine.route,
    frequency,
    food,
    durationDays,
    quantity: quantityFor(medicine.form, frequency, durationDays),
    drugClass: medicine.drugClass,
    instruction: overrides.instruction,
  };
}

export function formatDuration(days: number | null): string {
  if (days === null) return "Continue";
  if (days === 1) return "1 day";
  if (days % 30 === 0 && days >= 30) {
    const months = days / 30;
    return months === 1 ? "1 month" : `${months} months`;
  }
  if (days % 7 === 0 && days >= 14) return `${days / 7} weeks`;
  return `${days} days`;
}

/** One line, the way it would read on a printed slip. */
export function formatRxLine(p: Prescription): string {
  const parts = [
    `${p.drug} ${p.strength}`,
    formatFrequency(p.frequency),
    p.food !== "Any time" ? p.food.toLowerCase() : null,
    formatDuration(p.durationDays),
  ].filter(Boolean);
  return parts.join(" · ");
}

/** Short form used in timelines and summaries. */
export function formatRxShort(p: Prescription): string {
  return `${p.drug} ${p.strength} · ${formatFrequency(p.frequency)}`;
}

export const FREQUENCY_PRESETS: { label: string; value: Frequency }[] = [
  { label: "1-0-0", value: { morning: 1, afternoon: 0, night: 0 } },
  { label: "0-0-1", value: { morning: 0, afternoon: 0, night: 1 } },
  { label: "1-0-1", value: { morning: 1, afternoon: 0, night: 1 } },
  { label: "1-1-1", value: { morning: 1, afternoon: 1, night: 1 } },
  { label: "½-0-½", value: { morning: 0.5, afternoon: 0, night: 0.5 } },
  { label: "SOS", value: { morning: 0, afternoon: 0, night: 0, asNeeded: true } },
];

export const DURATION_PRESETS: { label: string; value: number | null }[] = [
  { label: "3 days", value: 3 },
  { label: "5 days", value: 5 },
  { label: "7 days", value: 7 },
  { label: "2 weeks", value: 14 },
  { label: "1 month", value: 30 },
  { label: "Continue", value: null },
];

export const FOOD_OPTIONS: FoodTiming[] = [
  "Before food",
  "After food",
  "With food",
  "Any time",
];
