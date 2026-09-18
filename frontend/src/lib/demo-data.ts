/**
 * Synthetic demo data. No real patient records are used anywhere in this
 * project. Shapes here mirror what the backend will eventually return, so the
 * logic in `clinical.ts` keeps working once this file is replaced by an API.
 *
 * `visits` is one flat array with a `patientId` on each row, the way a real
 * `visits` table works — filtered by patient rather than nested per patient.
 */

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

export type Prescription = {
  drug: string;
  dose: string;
  drugClass: DrugClass | "other";
};

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
  prescriptions: Prescription[];
  vitals: Vitals;
  admission?: boolean;
  /** structured detail captured at entry — never used to infer a diagnosis */
  chiefComplaint?: string;
  symptomTags?: string[];
  entryMethod?: "quick" | "detailed";
  /** append-only correction link: this visit replaces an earlier one */
  supersedes?: string;
};

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
      { drug: "Metformin", dose: "500mg", drugClass: "biguanide" },
      { drug: "Amlodipine", dose: "5mg", drugClass: "calcium-channel-blocker" },
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
    prescriptions: [{ drug: "Amoxicillin", dose: "500mg", drugClass: "penicillin" }],
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
      { drug: "Amlodipine", dose: "5mg", drugClass: "calcium-channel-blocker" },
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
      { drug: "Amlodipine", dose: "5mg", drugClass: "calcium-channel-blocker" },
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
    prescriptions: [{ drug: "Metformin", dose: "500mg", drugClass: "biguanide" }],
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
    prescriptions: [{ drug: "ORS", dose: "1 sachet", drugClass: "other" }],
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
    prescriptions: [{ drug: "Paracetamol", dose: "Syrup, 5ml", drugClass: "other" }],
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
      { drug: "Amlodipine", dose: "5mg", drugClass: "calcium-channel-blocker" },
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
    prescriptions: [{ drug: "Paracetamol", dose: "500mg", drugClass: "other" }],
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
    prescriptions: [{ drug: "Paracetamol", dose: "500mg", drugClass: "other" }],
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
    prescriptions: [{ drug: "Salbutamol inhaler", dose: "2 puffs PRN", drugClass: "other" }],
    vitals: { systolic: 118, diastolic: 74, weightKg: 62, heartRate: 72 },
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

/* ------------------------------------------------------------------ *
 * What each facility actually stocks
 * ------------------------------------------------------------------ */

export type MedicineOption = {
  drug: string;
  drugClass: DrugClass | "other";
  adultDose: string;
  /** omitted where the drug is not appropriate under 12 */
  childDose?: string;
};

const CORE: MedicineOption[] = [
  { drug: "Paracetamol", drugClass: "other", adultDose: "500mg", childDose: "Syrup, 5ml" },
  { drug: "ORS", drugClass: "other", adultDose: "1 sachet", childDose: "1 sachet" },
  { drug: "Metformin", drugClass: "biguanide", adultDose: "500mg" },
  { drug: "Amlodipine", drugClass: "calcium-channel-blocker", adultDose: "5mg" },
  { drug: "Amoxicillin", drugClass: "penicillin", adultDose: "500mg", childDose: "Syrup, 125mg" },
  { drug: "Azithromycin", drugClass: "macrolide", adultDose: "500mg", childDose: "Syrup, 200mg" },
  { drug: "Ibuprofen", drugClass: "nsaid", adultDose: "400mg" },
  { drug: "Cetirizine", drugClass: "other", adultDose: "10mg", childDose: "Syrup, 2.5ml" },
  { drug: "Salbutamol inhaler", drugClass: "other", adultDose: "2 puffs PRN", childDose: "1 puff PRN" },
  { drug: "Iron + folic acid", drugClass: "other", adultDose: "1 tablet daily" },
  { drug: "Zinc", drugClass: "other", adultDose: "20mg", childDose: "10mg" },
  { drug: "Antiseptic dressing", drugClass: "other", adultDose: "Topical", childDose: "Topical" },
];

export const facilityFormulary: Record<string, MedicineOption[]> = {
  "PHC Wagholi": CORE,
  "District Hospital Pune": [
    ...CORE,
    { drug: "Atorvastatin", drugClass: "other", adultDose: "10mg" },
    { drug: "Insulin (regular)", drugClass: "other", adultDose: "As charted" },
  ],
  "Rural PHC Baramati": CORE.filter((m) => m.drug !== "Insulin (regular)"),
  "Sub-Center Hadapsar": CORE.filter((m) =>
    ["Paracetamol", "ORS", "Zinc", "Cetirizine", "Antiseptic dressing", "Iron + folic acid"].includes(
      m.drug,
    ),
  ),
};

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
