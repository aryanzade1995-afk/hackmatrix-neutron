/**
 * Facility formulary, modelled on the kind of stock a public health centre in
 * India actually holds (India's Essential Medicines List is the reference).
 *
 * IMPORTANT — the strengths, default frequencies and paediatric rules below are
 * illustrative demo data, not a clinical reference. They have not been reviewed
 * by a clinician. Nothing in this project constitutes prescribing guidance.
 */

import type { DrugClass } from "./demo-data";

export type DoseForm =
  | "Tablet"
  | "Capsule"
  | "Syrup"
  | "Injection"
  | "Inhaler"
  | "Drops"
  | "Ointment"
  | "Sachet";

export type Route = "Oral" | "Topical" | "Inhaled" | "IM" | "IV" | "Ophthalmic";

export type FoodTiming = "Before food" | "After food" | "With food" | "Any time";

/** Positional dosing — the convention written on Indian prescriptions.
 *  1-0-1 means one in the morning, none at midday, one at night. */
export type Frequency = {
  morning: number;
  afternoon: number;
  night: number;
  /** SOS / PRN — taken only when needed, so no fixed schedule */
  asNeeded?: boolean;
};

export type MedicineCategory =
  | "Analgesic / antipyretic"
  | "Antibiotic"
  | "Antidiabetic"
  | "Cardiovascular"
  | "Respiratory"
  | "Gastrointestinal"
  | "Antihistamine"
  | "Vitamin / supplement"
  | "Antitubercular"
  | "Antimalarial"
  | "Topical"
  | "Fluids";

export type MedicineOption = {
  drug: string;
  drugClass: DrugClass | "other";
  category: MedicineCategory;
  strengths: string[];
  form: DoseForm;
  route: Route;
  defaultFrequency: Frequency;
  defaultFood: FoodTiming;
  defaultDurationDays: number | null;
  /** Shown to the doctor as a reference. Never auto-applied. */
  paediatricRule?: string;
};

const OD_MORNING: Frequency = { morning: 1, afternoon: 0, night: 0 };
const OD_NIGHT: Frequency = { morning: 0, afternoon: 0, night: 1 };
const BD: Frequency = { morning: 1, afternoon: 0, night: 1 };
const TDS: Frequency = { morning: 1, afternoon: 1, night: 1 };
const SOS: Frequency = { morning: 0, afternoon: 0, night: 0, asNeeded: true };

export const MEDICINES: MedicineOption[] = [
  /* ---- Analgesic / antipyretic ---- */
  {
    drug: "Paracetamol",
    drugClass: "other",
    category: "Analgesic / antipyretic",
    strengths: ["500mg", "650mg", "125mg/5ml syrup"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: TDS,
    defaultFood: "After food",
    defaultDurationDays: 3,
    paediatricRule: "15 mg/kg per dose, up to 4 doses in 24 hours",
  },
  {
    drug: "Ibuprofen",
    drugClass: "nsaid",
    category: "Analgesic / antipyretic",
    strengths: ["200mg", "400mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "After food",
    defaultDurationDays: 3,
    paediatricRule: "10 mg/kg per dose",
  },
  {
    drug: "Diclofenac",
    drugClass: "nsaid",
    category: "Analgesic / antipyretic",
    strengths: ["50mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "After food",
    defaultDurationDays: 3,
  },
  {
    drug: "Aspirin",
    drugClass: "nsaid",
    category: "Analgesic / antipyretic",
    strengths: ["75mg", "150mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "After food",
    defaultDurationDays: null,
  },

  /* ---- Antibiotic ---- */
  {
    drug: "Amoxicillin",
    drugClass: "penicillin",
    category: "Antibiotic",
    strengths: ["250mg", "500mg", "125mg/5ml syrup"],
    form: "Capsule",
    route: "Oral",
    defaultFrequency: TDS,
    defaultFood: "After food",
    defaultDurationDays: 5,
    paediatricRule: "25–50 mg/kg per day, divided",
  },
  {
    drug: "Amoxicillin + Clavulanate",
    drugClass: "penicillin",
    category: "Antibiotic",
    strengths: ["625mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "After food",
    defaultDurationDays: 5,
  },
  {
    drug: "Azithromycin",
    drugClass: "macrolide",
    category: "Antibiotic",
    strengths: ["250mg", "500mg", "200mg/5ml syrup"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Before food",
    defaultDurationDays: 3,
    paediatricRule: "10 mg/kg once daily",
  },
  {
    drug: "Ciprofloxacin",
    drugClass: "other",
    category: "Antibiotic",
    strengths: ["250mg", "500mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "After food",
    defaultDurationDays: 5,
  },
  {
    drug: "Doxycycline",
    drugClass: "other",
    category: "Antibiotic",
    strengths: ["100mg"],
    form: "Capsule",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "After food",
    defaultDurationDays: 7,
  },
  {
    drug: "Metronidazole",
    drugClass: "other",
    category: "Antibiotic",
    strengths: ["200mg", "400mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: TDS,
    defaultFood: "After food",
    defaultDurationDays: 5,
  },
  {
    drug: "Cotrimoxazole",
    drugClass: "other",
    category: "Antibiotic",
    strengths: ["480mg", "960mg DS"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "After food",
    defaultDurationDays: 5,
  },
  {
    drug: "Cefixime",
    drugClass: "other",
    category: "Antibiotic",
    strengths: ["200mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "After food",
    defaultDurationDays: 5,
  },

  /* ---- Antidiabetic ---- */
  {
    drug: "Metformin",
    drugClass: "biguanide",
    category: "Antidiabetic",
    strengths: ["500mg", "850mg", "1000mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "After food",
    defaultDurationDays: null,
  },
  {
    drug: "Glimepiride",
    drugClass: "other",
    category: "Antidiabetic",
    strengths: ["1mg", "2mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Before food",
    defaultDurationDays: null,
  },
  {
    drug: "Insulin (regular)",
    drugClass: "other",
    category: "Antidiabetic",
    strengths: ["40 IU/ml"],
    form: "Injection",
    route: "IM",
    defaultFrequency: BD,
    defaultFood: "Before food",
    defaultDurationDays: null,
  },

  /* ---- Cardiovascular ---- */
  {
    drug: "Amlodipine",
    drugClass: "calcium-channel-blocker",
    category: "Cardiovascular",
    strengths: ["2.5mg", "5mg", "10mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Any time",
    defaultDurationDays: null,
  },
  {
    drug: "Telmisartan",
    drugClass: "other",
    category: "Cardiovascular",
    strengths: ["20mg", "40mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Any time",
    defaultDurationDays: null,
  },
  {
    drug: "Atenolol",
    drugClass: "other",
    category: "Cardiovascular",
    strengths: ["25mg", "50mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Any time",
    defaultDurationDays: null,
  },
  {
    drug: "Enalapril",
    drugClass: "other",
    category: "Cardiovascular",
    strengths: ["2.5mg", "5mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "Any time",
    defaultDurationDays: null,
  },
  {
    drug: "Hydrochlorothiazide",
    drugClass: "other",
    category: "Cardiovascular",
    strengths: ["12.5mg", "25mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Any time",
    defaultDurationDays: null,
  },
  {
    drug: "Atorvastatin",
    drugClass: "other",
    category: "Cardiovascular",
    strengths: ["10mg", "20mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_NIGHT,
    defaultFood: "Any time",
    defaultDurationDays: null,
  },

  /* ---- Respiratory ---- */
  {
    drug: "Salbutamol inhaler",
    drugClass: "other",
    category: "Respiratory",
    strengths: ["100mcg/puff"],
    form: "Inhaler",
    route: "Inhaled",
    defaultFrequency: SOS,
    defaultFood: "Any time",
    defaultDurationDays: null,
  },
  {
    drug: "Budesonide inhaler",
    drugClass: "other",
    category: "Respiratory",
    strengths: ["200mcg/puff"],
    form: "Inhaler",
    route: "Inhaled",
    defaultFrequency: BD,
    defaultFood: "Any time",
    defaultDurationDays: null,
  },
  {
    drug: "Montelukast",
    drugClass: "other",
    category: "Respiratory",
    strengths: ["5mg", "10mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_NIGHT,
    defaultFood: "Any time",
    defaultDurationDays: 28,
  },

  /* ---- Gastrointestinal ---- */
  {
    drug: "Omeprazole",
    drugClass: "other",
    category: "Gastrointestinal",
    strengths: ["20mg"],
    form: "Capsule",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Before food",
    defaultDurationDays: 14,
  },
  {
    drug: "Pantoprazole",
    drugClass: "other",
    category: "Gastrointestinal",
    strengths: ["40mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Before food",
    defaultDurationDays: 14,
  },
  {
    drug: "Domperidone",
    drugClass: "other",
    category: "Gastrointestinal",
    strengths: ["10mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: TDS,
    defaultFood: "Before food",
    defaultDurationDays: 3,
  },
  {
    drug: "Ondansetron",
    drugClass: "other",
    category: "Gastrointestinal",
    strengths: ["4mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: SOS,
    defaultFood: "Any time",
    defaultDurationDays: 2,
    paediatricRule: "0.1 mg/kg per dose",
  },
  {
    drug: "Zinc",
    drugClass: "other",
    category: "Gastrointestinal",
    strengths: ["20mg", "10mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "After food",
    defaultDurationDays: 14,
    paediatricRule: "10 mg under 6 months, 20 mg above",
  },

  /* ---- Antihistamine ---- */
  {
    drug: "Cetirizine",
    drugClass: "other",
    category: "Antihistamine",
    strengths: ["10mg", "5mg/5ml syrup"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_NIGHT,
    defaultFood: "Any time",
    defaultDurationDays: 5,
    paediatricRule: "2.5 mg under 6 years",
  },
  {
    drug: "Levocetirizine",
    drugClass: "other",
    category: "Antihistamine",
    strengths: ["5mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_NIGHT,
    defaultFood: "Any time",
    defaultDurationDays: 5,
  },
  {
    drug: "Chlorpheniramine",
    drugClass: "other",
    category: "Antihistamine",
    strengths: ["4mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "After food",
    defaultDurationDays: 3,
  },

  /* ---- Vitamin / supplement ---- */
  {
    drug: "Iron + folic acid",
    drugClass: "other",
    category: "Vitamin / supplement",
    strengths: ["100mg + 500mcg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "After food",
    defaultDurationDays: 90,
  },
  {
    drug: "Folic acid",
    drugClass: "other",
    category: "Vitamin / supplement",
    strengths: ["5mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "After food",
    defaultDurationDays: 90,
  },
  {
    drug: "Vitamin D3",
    drugClass: "other",
    category: "Vitamin / supplement",
    strengths: ["60000 IU"],
    form: "Sachet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "After food",
    defaultDurationDays: 56,
  },
  {
    drug: "Calcium + D3",
    drugClass: "other",
    category: "Vitamin / supplement",
    strengths: ["500mg + 250 IU"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_NIGHT,
    defaultFood: "After food",
    defaultDurationDays: 90,
  },
  {
    drug: "Vitamin B complex",
    drugClass: "other",
    category: "Vitamin / supplement",
    strengths: ["1 tablet"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "After food",
    defaultDurationDays: 30,
  },

  /* ---- Antitubercular ---- */
  {
    drug: "Isoniazid",
    drugClass: "other",
    category: "Antitubercular",
    strengths: ["300mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Before food",
    defaultDurationDays: 180,
  },
  {
    drug: "Rifampicin",
    drugClass: "other",
    category: "Antitubercular",
    strengths: ["450mg", "600mg"],
    form: "Capsule",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "Before food",
    defaultDurationDays: 180,
  },

  /* ---- Antimalarial ---- */
  {
    drug: "Chloroquine",
    drugClass: "other",
    category: "Antimalarial",
    strengths: ["250mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: OD_MORNING,
    defaultFood: "After food",
    defaultDurationDays: 3,
  },
  {
    drug: "Artemether + Lumefantrine",
    drugClass: "other",
    category: "Antimalarial",
    strengths: ["80mg + 480mg"],
    form: "Tablet",
    route: "Oral",
    defaultFrequency: BD,
    defaultFood: "With food",
    defaultDurationDays: 3,
  },

  /* ---- Topical ---- */
  {
    drug: "Povidone iodine",
    drugClass: "other",
    category: "Topical",
    strengths: ["5% ointment"],
    form: "Ointment",
    route: "Topical",
    defaultFrequency: BD,
    defaultFood: "Any time",
    defaultDurationDays: 7,
  },
  {
    drug: "Clotrimazole",
    drugClass: "other",
    category: "Topical",
    strengths: ["1% cream"],
    form: "Ointment",
    route: "Topical",
    defaultFrequency: BD,
    defaultFood: "Any time",
    defaultDurationDays: 14,
  },
  {
    drug: "Silver sulfadiazine",
    drugClass: "other",
    category: "Topical",
    strengths: ["1% cream"],
    form: "Ointment",
    route: "Topical",
    defaultFrequency: OD_NIGHT,
    defaultFood: "Any time",
    defaultDurationDays: 7,
  },

  /* ---- Fluids ---- */
  {
    drug: "ORS",
    drugClass: "other",
    category: "Fluids",
    strengths: ["1 sachet in 1 L"],
    form: "Sachet",
    route: "Oral",
    defaultFrequency: SOS,
    defaultFood: "Any time",
    defaultDurationDays: 3,
    paediatricRule: "10 ml/kg after each loose stool",
  },
];

export const MEDICINE_CATEGORIES: MedicineCategory[] = [
  "Analgesic / antipyretic",
  "Antibiotic",
  "Antidiabetic",
  "Cardiovascular",
  "Respiratory",
  "Gastrointestinal",
  "Antihistamine",
  "Vitamin / supplement",
  "Antitubercular",
  "Antimalarial",
  "Topical",
  "Fluids",
];

/** Smaller facilities carry less. A sub-centre has no doctor on site. */
const SUB_CENTRE_STOCK = [
  "Paracetamol",
  "ORS",
  "Zinc",
  "Cetirizine",
  "Iron + folic acid",
  "Folic acid",
  "Povidone iodine",
  "Vitamin B complex",
  "Cotrimoxazole",
];

export function formularyFor(facility: string): MedicineOption[] {
  if (facility === "Sub-Center Hadapsar") {
    return MEDICINES.filter((m) => SUB_CENTRE_STOCK.includes(m.drug));
  }
  if (facility === "Rural PHC Baramati") {
    return MEDICINES.filter((m) => m.drug !== "Insulin (regular)");
  }
  return MEDICINES;
}
