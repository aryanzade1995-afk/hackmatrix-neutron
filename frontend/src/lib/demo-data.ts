/**
 * Synthetic demo data. No real patient records are used anywhere in this
 * project. Shapes here mirror what the backend will eventually return, so the
 * logic in `clinical.ts` keeps working once this file is replaced by an API.
 *
 * `visits` is one flat array with a `patientId` on each row, the way a real
 * `visits` table works — filtered by patient rather than nested per patient.
 */

import { MEDICINES, type FoodTiming, type Frequency } from "./formulary";
import { buildPrescription, type Prescription as PrescriptionType } from "./prescribing";

/** Drug classes we can reason about. An allergy matches a prescription when
 *  both carry the same class — which is how the conflict check works. */
export type DrugClass =
  | "penicillin"
  | "biguanide"
  | "calcium-channel-blocker"
  | "macrolide"
  | "nsaid";

export const DRUG_CLASSES: DrugClass[] = [
  "penicillin",
  "biguanide",
  "calcium-channel-blocker",
  "macrolide",
  "nsaid",
];

export type { Prescription } from "./prescribing";

export type Vitals = {
  systolic?: number;
  diastolic?: number;
  hba1c?: number;
  weightKg?: number;
  heartRate?: number;
};

export type Allergy = {
  label: string;
  drugClass: DrugClass;
  recorded: string;
  severity: "severe" | "moderate";
};

export type Patient = {
  id: string;
  name: string;
  /** ISO date — age is derived, never stored, so it cannot go stale */
  dob: string;
  gender: "Female" | "Male" | "Other";
  /** optional, used to reissue a lost QR */
  phone?: string;
  facility: string;
  district: string;
  conditions: string[];
  allergies: Allergy[];
  registeredAt: string;
};

export type Visit = {
  id: string;
  patientId: string;
  /** ISO date, used for ordering and diffing */
  date: string;
  /** Pre-formatted for display, so the UI never parses dates */
  display: string;
  facility: string;
  diagnosis: string;
  notes: string;
  prescriptions: PrescriptionType[];
  vitals: Vitals;
  admission?: boolean;
  /** structured detail captured at entry — never used to infer a diagnosis */
  chiefComplaint?: string;
  symptomTags?: string[];
  entryMethod?: "quick" | "detailed";
  /** append-only correction link: this visit replaces an earlier one */
  supersedes?: string;
};

/** Seed helper — looks the medicine up in the formulary so the seeded visits
 *  carry exactly the same shape a doctor would produce through the UI. */
function rx(
  drug: string,
  strength: string,
  frequency: Frequency,
  food: FoodTiming,
  durationDays: number | null,
): PrescriptionType {
  const medicine = MEDICINES.find((m) => m.drug === drug);
  if (!medicine) throw new Error(`Unknown medicine in seed data: ${drug}`);
  return buildPrescription(medicine, { strength, frequency, food, durationDays });
}

export const FACILITIES = [
  "PHC Wagholi",
  "District Hospital Pune",
  "Rural PHC Baramati",
  "Sub-Center Hadapsar",
];

export const DISTRICTS = ["Pune City", "Wagholi", "Hadapsar", "Baramati"];

/* ------------------------------------------------------------------ *
 * Patients
 * ------------------------------------------------------------------ */

export const patients: Patient[] = [
  {
    id: "PT-2291",
    name: "Priya Nair",
    dob: "1979-04-12",
    gender: "Female",
    phone: "+91 98xxxxxx12",
    facility: "PHC Wagholi",
    district: "Pune City",
    conditions: ["Type 2 diabetes", "Hypertension"],
    allergies: [
      {
        label: "Penicillin",
        drugClass: "penicillin",
        recorded: "02 Jun 2023",
        severity: "severe",
      },
    ],
    registeredAt: "2023-06-02",
  },
  {
    id: "PT-2314",
    name: "Aarav Kulkarni",
    dob: "2018-11-30",
    gender: "Male",
    phone: "+91 97xxxxxx40",
    facility: "Sub-Center Hadapsar",
    district: "Hadapsar",
    conditions: [],
    allergies: [],
    registeredAt: "2024-01-18",
  },
  {
    id: "PT-2356",
    name: "Sunita Deshpande",
    dob: "1962-08-03",
    gender: "Female",
    phone: "+91 96xxxxxx77",
    facility: "Rural PHC Baramati",
    district: "Baramati",
    conditions: ["Hypertension"],
    allergies: [
      {
        label: "Ibuprofen",
        drugClass: "nsaid",
        recorded: "14 Feb 2025",
        severity: "moderate",
      },
    ],
    registeredAt: "2024-09-05",
  },
  {
    id: "PT-2402",
    name: "Imran Shaikh",
    dob: "1995-02-21",
    gender: "Male",
    facility: "PHC Wagholi",
    district: "Wagholi",
    conditions: [],
    allergies: [],
    registeredAt: "2025-03-11",
  },
  {
    id: "PT-2447",
    name: "Meera Joshi",
    dob: "1988-07-16",
    gender: "Female",
    phone: "+91 99xxxxxx08",
    facility: "District Hospital Pune",
    district: "Pune City",
    conditions: ["Asthma"],
    allergies: [],
    registeredAt: "2025-10-02",
  },

  {
    id: "PT-2481",
    name: "Vikram Pawar",
    dob: "1985-03-22",
    gender: "Male",
    phone: "+91 98xxxxxx31",
    facility: "PHC Wagholi",
    district: "Wagholi",
    conditions: [],
    allergies: [],
    registeredAt: "2025-11-10",
  },
  {
    id: "PT-2492",
    name: "Zara Sheikh",
    dob: "1998-09-05",
    gender: "Female",
    phone: "+91 97xxxxxx84",
    facility: "District Hospital Pune",
    district: "Pune City",
    conditions: [],
    allergies: [],
    registeredAt: "2026-02-01",
  },
  {
    id: "PT-2503",
    name: "Ganesh Jadhav",
    dob: "1958-12-01",
    gender: "Male",
    facility: "Rural PHC Baramati",
    district: "Baramati",
    conditions: ["Hypertension", "Osteoarthritis"],
    allergies: [
      { label: "Diclofenac", drugClass: "nsaid", recorded: "11 Mar 2022", severity: "moderate" },
    ],
    registeredAt: "2024-05-20",
  },
  {
    id: "PT-2514",
    name: "Ashwini More",
    dob: "2001-06-18",
    gender: "Female",
    phone: "+91 96xxxxxx45",
    facility: "Sub-Center Hadapsar",
    district: "Hadapsar",
    conditions: [],
    allergies: [],
    registeredAt: "2026-03-12",
  },
  {
    id: "PT-2525",
    name: "Faisal Ansari",
    dob: "1975-11-30",
    gender: "Male",
    phone: "+91 95xxxxxx67",
    facility: "PHC Wagholi",
    district: "Wagholi",
    conditions: [],
    allergies: [],
    registeredAt: "2025-08-22",
  },
  {
    id: "PT-2536",
    name: "Rupali Kale",
    dob: "2015-02-14",
    gender: "Female",
    phone: "+91 94xxxxxx23",
    facility: "Sub-Center Hadapsar",
    district: "Hadapsar",
    conditions: [],
    allergies: [],
    registeredAt: "2025-06-01",
  },
  {
    id: "PT-2547",
    name: "Yusuf Pathan",
    dob: "1990-04-09",
    gender: "Male",
    phone: "+91 93xxxxxx56",
    facility: "District Hospital Pune",
    district: "Pune City",
    conditions: [],
    allergies: [],
    registeredAt: "2026-01-05",
  },
  {
    id: "PT-2558",
    name: "Manisha Bhosale",
    dob: "1968-07-25",
    gender: "Female",
    phone: "+91 92xxxxxx78",
    facility: "Rural PHC Baramati",
    district: "Baramati",
    conditions: ["Type 2 diabetes"],
    allergies: [],
    registeredAt: "2024-11-15",
  },
  {
    id: "PT-2569",
    name: "Arjun Naik",
    dob: "2012-08-14",
    gender: "Male",
    phone: "+91 91xxxxxx90",
    facility: "PHC Wagholi",
    district: "Wagholi",
    conditions: ["Asthma"],
    allergies: [],
    registeredAt: "2023-09-10",
  },
  {
    id: "PT-2580",
    name: "Komal Verma",
    dob: "1993-01-27",
    gender: "Female",
    phone: "+91 90xxxxxx13",
    facility: "District Hospital Pune",
    district: "Pune City",
    conditions: [],
    allergies: [
      { label: "Amoxicillin", drugClass: "penicillin", recorded: "02 Nov 2025", severity: "severe" },
    ],
    registeredAt: "2025-12-01",
  },
];

/* ------------------------------------------------------------------ *
 * Visits — newest first
 * ------------------------------------------------------------------ */

export const visits: Visit[] = [
  {
    id: "v-2026-08-12",
    patientId: "PT-2291",
    date: "2026-08-12",
    display: "12 Aug 2026",
    facility: "PHC Wagholi",
    diagnosis: "Routine diabetes follow-up",
    notes: "HbA1c stable at 6.8. Continue current dose, review in six months.",
    prescriptions: [
      rx("Metformin", "500mg", { morning: 1, afternoon: 0, night: 1 }, "After food", null),
      rx("Amlodipine", "5mg", { morning: 1, afternoon: 0, night: 0 }, "Any time", null),
    ],
    vitals: { systolic: 138, diastolic: 86, hba1c: 6.8, weightKg: 64, heartRate: 78 },
  },
  {
    id: "v-2026-05-21",
    patientId: "PT-2291",
    date: "2026-05-21",
    display: "21 May 2026",
    facility: "Sub-Center Hadapsar",
    diagnosis: "Throat infection",
    notes:
      "Seen at a facility with no access to her records. Penicillin-class antibiotic prescribed without sight of the allergy noted at PHC Wagholi in 2023.",
    prescriptions: [rx("Amoxicillin", "500mg", { morning: 1, afternoon: 1, night: 1 }, "After food", 5)],
    vitals: { systolic: 142, diastolic: 88, weightKg: 64.5, heartRate: 82 },
  },
  {
    id: "v-2026-03-03",
    patientId: "PT-2291",
    date: "2026-03-03",
    display: "03 Mar 2026",
    facility: "District Hospital Pune",
    diagnosis: "Hypertensive episode, ER admission",
    notes: "Presented with BP 178/104. Stabilised overnight, discharged next morning.",
    prescriptions: [
      rx("Amlodipine", "5mg", { morning: 1, afternoon: 0, night: 0 }, "Any time", null),
    ],
    vitals: { systolic: 178, diastolic: 104, weightKg: 65, heartRate: 96 },
    admission: true,
  },
  {
    id: "v-2025-11-17",
    patientId: "PT-2291",
    date: "2025-11-17",
    display: "17 Nov 2025",
    facility: "PHC Wagholi",
    diagnosis: "Hypertensive episode, ER admission",
    notes: "Second hypertensive episode. Started on amlodipine.",
    prescriptions: [
      rx("Amlodipine", "5mg", { morning: 1, afternoon: 0, night: 0 }, "Any time", null),
    ],
    vitals: { systolic: 172, diastolic: 101, weightKg: 66, heartRate: 94 },
    admission: true,
  },
  {
    id: "v-2023-06-02",
    patientId: "PT-2291",
    date: "2023-06-02",
    display: "02 Jun 2023",
    facility: "PHC Wagholi",
    diagnosis: "Diabetes diagnosis, initial workup",
    notes: "Fasting glucose 156. Type 2 diabetes confirmed. Penicillin allergy recorded.",
    prescriptions: [
      rx("Metformin", "500mg", { morning: 1, afternoon: 0, night: 1 }, "After food", null),
    ],
    vitals: { systolic: 150, diastolic: 92, hba1c: 7.9, weightKg: 68, heartRate: 88 },
  },

  /* Aarav — a child, so the formulary shows paediatric dosing */
  {
    id: "v-2026-07-04",
    patientId: "PT-2314",
    date: "2026-07-04",
    display: "04 Jul 2026",
    facility: "Sub-Center Hadapsar",
    diagnosis: "Acute gastroenteritis",
    notes: "Mild dehydration. ORS advised, follow up if symptoms persist beyond 3 days.",
    prescriptions: [rx("ORS", "1 sachet in 1 L", { morning: 0, afternoon: 0, night: 0, asNeeded: true }, "Any time", 3)],
    vitals: { weightKg: 22, heartRate: 104 },
    chiefComplaint: "Diarrhea",
    symptomTags: ["1-2 days", "Vomiting"],
    entryMethod: "quick",
  },
  {
    id: "v-2026-02-09",
    patientId: "PT-2314",
    date: "2026-02-09",
    display: "09 Feb 2026",
    facility: "Sub-Center Hadapsar",
    diagnosis: "Upper respiratory infection",
    notes: "Viral. Symptomatic care only.",
    prescriptions: [rx("Paracetamol", "125mg/5ml syrup", { morning: 1, afternoon: 1, night: 1 }, "After food", 3)],
    vitals: { weightKg: 21, heartRate: 98 },
    chiefComplaint: "Cough / cold",
    symptomTags: ["3-5 days"],
    entryMethod: "quick",
  },

  /* Sunita */
  {
    id: "v-2026-06-19",
    patientId: "PT-2356",
    date: "2026-06-19",
    display: "19 Jun 2026",
    facility: "Rural PHC Baramati",
    diagnosis: "Routine hypertension follow-up",
    notes: "BP well controlled on current dose.",
    prescriptions: [
      rx("Amlodipine", "5mg", { morning: 1, afternoon: 0, night: 0 }, "Any time", null),
    ],
    vitals: { systolic: 134, diastolic: 84, weightKg: 58, heartRate: 74 },
  },
  {
    id: "v-2025-02-14",
    patientId: "PT-2356",
    date: "2025-02-14",
    display: "14 Feb 2025",
    facility: "Rural PHC Baramati",
    diagnosis: "Joint pain",
    notes: "Reaction to ibuprofen noted and recorded as an allergy.",
    prescriptions: [rx("Paracetamol", "500mg", { morning: 1, afternoon: 1, night: 1 }, "After food", 3)],
    vitals: { systolic: 146, diastolic: 90, weightKg: 59, heartRate: 80 },
    chiefComplaint: "Body ache",
    symptomTags: ["5+ days"],
    entryMethod: "detailed",
  },

  /* Imran */
  {
    id: "v-2026-04-27",
    patientId: "PT-2402",
    date: "2026-04-27",
    display: "27 Apr 2026",
    facility: "PHC Wagholi",
    diagnosis: "Laceration, left forearm",
    notes: "Cleaned and dressed. Tetanus status confirmed current.",
    prescriptions: [rx("Paracetamol", "500mg", { morning: 1, afternoon: 1, night: 1 }, "After food", 3)],
    vitals: { systolic: 124, diastolic: 78, weightKg: 71, heartRate: 76 },
    chiefComplaint: "Injury / wound",
    symptomTags: ["Bleeding stopped"],
    entryMethod: "quick",
  },

  /* Meera */
  {
    id: "v-2026-08-02",
    patientId: "PT-2447",
    date: "2026-08-02",
    display: "02 Aug 2026",
    facility: "District Hospital Pune",
    diagnosis: "Asthma review",
    notes: "Inhaler technique reviewed. No night symptoms reported.",
    prescriptions: [rx("Salbutamol inhaler", "100mcg/puff", { morning: 0, afternoon: 0, night: 0, asNeeded: true }, "Any time", null)],
    vitals: { systolic: 118, diastolic: 74, weightKg: 62, heartRate: 72 },
  },

  /* Vikram — pulmonary TB, DOTS therapy across two visits */
  {
    id: "v-2026-01-15",
    patientId: "PT-2481",
    date: "2026-01-15",
    display: "15 Jan 2026",
    facility: "PHC Wagholi",
    diagnosis: "Pulmonary tuberculosis, treatment initiated",
    notes: "Sputum positive. DOTS therapy started, monthly follow-up advised.",
    prescriptions: [
      rx("Isoniazid", "300mg", { morning: 1, afternoon: 0, night: 0 }, "Before food", 180),
      rx("Rifampicin", "450mg", { morning: 1, afternoon: 0, night: 0 }, "Before food", 180),
    ],
    vitals: { weightKg: 58, heartRate: 88 },
  },
  {
    id: "v-2026-04-20",
    patientId: "PT-2481",
    date: "2026-04-20",
    display: "20 Apr 2026",
    facility: "PHC Wagholi",
    diagnosis: "Tuberculosis follow-up",
    notes: "Improving, weight gain noted, continue therapy.",
    prescriptions: [
      rx("Isoniazid", "300mg", { morning: 1, afternoon: 0, night: 0 }, "Before food", 90),
      rx("Rifampicin", "450mg", { morning: 1, afternoon: 0, night: 0 }, "Before food", 90),
    ],
    vitals: { weightKg: 61, heartRate: 82 },
  },

  /* Zara — routine antenatal care */
  {
    id: "v-2026-06-10",
    patientId: "PT-2492",
    date: "2026-06-10",
    display: "10 Jun 2026",
    facility: "District Hospital Pune",
    diagnosis: "Antenatal checkup, second trimester",
    notes: "Fundal height appropriate for gestational age. Iron and folic acid continued.",
    prescriptions: [
      rx("Iron + folic acid", "100mg + 500mcg", { morning: 1, afternoon: 0, night: 0 }, "After food", 90),
      rx("Calcium + D3", "500mg + 250 IU", { morning: 0, afternoon: 0, night: 1 }, "After food", 90),
    ],
    vitals: { systolic: 112, diastolic: 74, weightKg: 62, heartRate: 82 },
  },

  /* Ganesh — an allergy correctly avoided, the mirror image of Priya's story */
  {
    id: "v-2026-07-01",
    patientId: "PT-2503",
    date: "2026-07-01",
    display: "01 Jul 2026",
    facility: "Rural PHC Baramati",
    diagnosis: "Osteoarthritis, knee pain flare",
    notes: "Advised paracetamol rather than an NSAID given the recorded diclofenac allergy. Physiotherapy referral given.",
    prescriptions: [rx("Paracetamol", "500mg", { morning: 1, afternoon: 1, night: 1 }, "After food", 5)],
    vitals: { weightKg: 72, heartRate: 80 },
  },
  {
    id: "v-2026-08-15",
    patientId: "PT-2503",
    date: "2026-08-15",
    display: "15 Aug 2026",
    facility: "Rural PHC Baramati",
    diagnosis: "Routine hypertension follow-up",
    notes: "BP controlled, continue current medication.",
    prescriptions: [rx("Amlodipine", "5mg", { morning: 1, afternoon: 0, night: 0 }, "Any time", null)],
    vitals: { systolic: 136, diastolic: 84, weightKg: 72, heartRate: 76 },
  },

  /* Ashwini */
  {
    id: "v-2026-05-02",
    patientId: "PT-2514",
    date: "2026-05-02",
    display: "02 May 2026",
    facility: "Sub-Center Hadapsar",
    diagnosis: "Urinary tract infection",
    notes: "Burning micturition for three days, no fever. Urine routine advised.",
    prescriptions: [rx("Cotrimoxazole", "480mg", { morning: 1, afternoon: 0, night: 1 }, "After food", 5)],
    vitals: { heartRate: 78 },
  },

  /* Faisal */
  {
    id: "v-2026-08-05",
    patientId: "PT-2525",
    date: "2026-08-05",
    display: "05 Aug 2026",
    facility: "PHC Wagholi",
    diagnosis: "Chikungunya",
    notes: "Fever with severe joint pain for four days. Advised rest, hydration, and paracetamol.",
    prescriptions: [rx("Paracetamol", "650mg", { morning: 1, afternoon: 1, night: 1 }, "After food", 5)],
    vitals: { heartRate: 92, weightKg: 74 },
  },

  /* Rupali — a child */
  {
    id: "v-2026-07-20",
    patientId: "PT-2536",
    date: "2026-07-20",
    display: "20 Jul 2026",
    facility: "Sub-Center Hadapsar",
    diagnosis: "Anemia",
    notes: "Pallor noted on examination. Iron supplementation started, Hb test advised.",
    prescriptions: [rx("Iron + folic acid", "100mg + 500mcg", { morning: 1, afternoon: 0, night: 0 }, "After food", 90)],
    vitals: { weightKg: 18, heartRate: 96 },
  },

  /* Yusuf */
  {
    id: "v-2026-06-25",
    patientId: "PT-2547",
    date: "2026-06-25",
    display: "25 Jun 2026",
    facility: "District Hospital Pune",
    diagnosis: "Malaria",
    notes: "Fever with chills. Rapid diagnostic test positive for P. vivax.",
    prescriptions: [rx("Chloroquine", "250mg", { morning: 1, afternoon: 0, night: 0 }, "After food", 3)],
    vitals: { heartRate: 100, weightKg: 70 },
  },

  /* Manisha */
  {
    id: "v-2026-07-30",
    patientId: "PT-2558",
    date: "2026-07-30",
    display: "30 Jul 2026",
    facility: "Rural PHC Baramati",
    diagnosis: "Routine diabetes follow-up",
    notes: "HbA1c 7.2, dose adjusted.",
    prescriptions: [
      rx("Metformin", "850mg", { morning: 1, afternoon: 0, night: 1 }, "After food", null),
      rx("Glimepiride", "2mg", { morning: 1, afternoon: 0, night: 0 }, "Before food", null),
    ],
    vitals: { hba1c: 7.2, weightKg: 66, heartRate: 80 },
  },

  /* Arjun — a child with asthma */
  {
    id: "v-2026-08-08",
    patientId: "PT-2569",
    date: "2026-08-08",
    display: "08 Aug 2026",
    facility: "PHC Wagholi",
    diagnosis: "Asthma review",
    notes: "Occasional night cough reported. Inhaler technique reviewed.",
    prescriptions: [
      rx("Salbutamol inhaler", "100mcg/puff", { morning: 0, afternoon: 0, night: 0, asNeeded: true }, "Any time", null),
      rx("Montelukast", "5mg", { morning: 0, afternoon: 0, night: 1 }, "Any time", 28),
    ],
    vitals: { heartRate: 90, weightKg: 32 },
  },

  /* Komal — a second allergy correctly avoided */
  {
    id: "v-2026-08-18",
    patientId: "PT-2580",
    date: "2026-08-18",
    display: "18 Aug 2026",
    facility: "District Hospital Pune",
    diagnosis: "Skin infection, cellulitis left leg",
    notes: "Localized redness and swelling. Avoided a penicillin-class antibiotic due to the recorded allergy; an alternative was prescribed.",
    prescriptions: [rx("Cotrimoxazole", "960mg DS", { morning: 1, afternoon: 0, night: 1 }, "After food", 5)],
    vitals: { heartRate: 88, weightKg: 60 },
  },
];

/* ------------------------------------------------------------------ *
 * Chief complaints and their follow-up questions
 *
 * These capture structured detail only. They must never be used to
 * suggest, imply or auto-fill a diagnosis — that would cross into
 * clinical decision support, which this project deliberately avoids.
 * ------------------------------------------------------------------ */

export type FollowUpQuestion = {
  id: string;
  prompt: string;
  type: "single" | "multi";
  options: string[];
};

export type ChiefComplaint = {
  id: string;
  label: string;
  appliesTo?: { minAge?: number; maxAge?: number; genders?: Patient["gender"][] };
  followUps: FollowUpQuestion[];
};

const DURATION: FollowUpQuestion = {
  id: "duration",
  prompt: "How many days?",
  type: "single",
  options: ["1-2 days", "3-5 days", "5+ days"],
};

export const chiefComplaints: ChiefComplaint[] = [
  {
    id: "fever",
    label: "Fever",
    followUps: [
      DURATION,
      {
        id: "associated",
        prompt: "Along with it?",
        type: "multi",
        options: ["Body ache", "Rash", "Vomiting", "Cough", "None"],
      },
    ],
  },
  {
    id: "cough-cold",
    label: "Cough / cold",
    followUps: [
      DURATION,
      {
        id: "character",
        prompt: "Type of cough?",
        type: "single",
        options: ["Dry", "With phlegm", "Wheezing"],
      },
    ],
  },
  {
    id: "stomach",
    label: "Stomach issue",
    followUps: [
      DURATION,
      {
        id: "associated",
        prompt: "Along with it?",
        type: "multi",
        options: ["Vomiting", "Loose motions", "Blood", "Fever", "None"],
      },
    ],
  },
  {
    id: "diarrhea",
    label: "Diarrhea",
    followUps: [
      DURATION,
      {
        id: "hydration",
        prompt: "Drinking fluids?",
        type: "single",
        options: ["Normally", "Reduced", "Refusing"],
      },
    ],
  },
  {
    id: "injury",
    label: "Injury / wound",
    followUps: [
      {
        id: "bleeding",
        prompt: "Bleeding?",
        type: "single",
        options: ["Bleeding stopped", "Still bleeding", "No bleeding"],
      },
      {
        id: "site",
        prompt: "Where?",
        type: "single",
        options: ["Head", "Arm", "Leg", "Torso", "Other"],
      },
    ],
  },
  {
    id: "skin",
    label: "Skin issue",
    followUps: [
      DURATION,
      {
        id: "type",
        prompt: "What kind?",
        type: "multi",
        options: ["Rash", "Itching", "Swelling", "Discharge"],
      },
    ],
  },
  {
    id: "body-ache",
    label: "Body ache",
    followUps: [
      DURATION,
      {
        id: "site",
        prompt: "Where mainly?",
        type: "multi",
        options: ["Joints", "Back", "All over", "Head"],
      },
    ],
  },
  {
    id: "breathlessness",
    label: "Breathlessness",
    followUps: [
      DURATION,
      {
        id: "trigger",
        prompt: "When does it happen?",
        type: "single",
        options: ["On exertion", "At rest", "At night"],
      },
    ],
  },
  {
    id: "follow-up",
    label: "Routine follow-up",
    followUps: [
      {
        id: "reason",
        prompt: "For what?",
        type: "single",
        options: ["Diabetes", "Blood pressure", "Asthma", "Other ongoing"],
      },
    ],
  },
  {
    id: "pregnancy",
    label: "Pregnancy-related",
    appliesTo: { genders: ["Female"], minAge: 12, maxAge: 55 },
    followUps: [
      {
        id: "stage",
        prompt: "Which trimester?",
        type: "single",
        options: ["First", "Second", "Third", "Post-natal"],
      },
    ],
  },
  {
    id: "child-feeding",
    label: "Feeding / growth concern",
    appliesTo: { maxAge: 5 },
    followUps: [
      {
        id: "concern",
        prompt: "What's the concern?",
        type: "multi",
        options: ["Not feeding", "Weight loss", "Slow growth"],
      },
    ],
  },
  { id: "other", label: "Other", followUps: [DURATION] },
];

/* Formulary now lives in formulary.ts — richer shape, facility-aware. */
export { formularyFor, MEDICINES, MEDICINE_CATEGORIES } from "./formulary";
export type { MedicineOption, DoseForm, Route, FoodTiming, Frequency, MedicineCategory } from "./formulary";

/* ------------------------------------------------------------------ *
 * Access log and nav
 * ------------------------------------------------------------------ */

export const accessLog = [
  {
    who: "Dr. R. Deshmukh",
    role: "Clinician",
    when: "Today, 10:42 AM",
    action: "Viewed full record",
    outcome: "granted" as const,
    hash: "9f2a…c41b",
  },
  {
    who: "Unknown device",
    role: "No valid role",
    when: "Today, 10:41 AM",
    action: "Attempted record access via QR",
    outcome: "denied" as const,
    hash: "4d81…77ae",
  },
  {
    who: "K. Iyer",
    role: "Administrator",
    when: "Today, 09:58 AM",
    action: "Attempted patient lookup",
    outcome: "denied" as const,
    hash: "b07c…12f9",
  },
  {
    who: "Dr. R. Deshmukh",
    role: "Clinician",
    when: "12 Aug 2026, 9:05 AM",
    action: "Viewed full record",
    outcome: "granted" as const,
    hash: "2e55…9a03",
  },
];

export const clinicianTabs = [
  { label: "Scan", href: "/clinician/scan" },
  { label: "Register", href: "/clinician/register" },
  { label: "Find patient", href: "/clinician/find" },
  { label: "Record", href: "/clinician" },
  { label: "Visit history", href: "/clinician/history" },
  { label: "Audit log", href: "/clinician/audit" },
];

export const adminTabs = [
  { label: "Overview", href: "/admin" },
  { label: "Trends", href: "/admin/trends" },
  { label: "Ask", href: "/admin/ask" },
];

export const conditionsByDistrict = [
  { district: "Pune City", dengue: 141, diabetes: 118, hypertension: 96, tb: 44, malaria: 21 },
  { district: "Wagholi", dengue: 112, diabetes: 84, hypertension: 71, tb: 38, malaria: 19 },
  { district: "Hadapsar", dengue: 89, diabetes: 76, hypertension: 68, tb: 35, malaria: 24 },
  { district: "Baramati", dengue: 70, diabetes: 60, hypertension: 61, tb: 34, malaria: 23 },
];

/** The record every existing demo link falls back to. */
export const DEFAULT_PATIENT_ID = "PT-2291";
