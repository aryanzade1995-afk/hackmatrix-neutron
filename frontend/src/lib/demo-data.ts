/**
 * Synthetic demo data. No real patient records are used anywhere in this
 * project. Shapes here mirror what the backend will eventually return, so the
 * logic in `clinical.ts` keeps working once this file is replaced by an API.
 */

/** Drug classes we can reason about. An allergy matches a prescription when
 *  both carry the same class — which is how the conflict check works. */
export type DrugClass =
  | "penicillin"
  | "biguanide"
  | "calcium-channel-blocker"
  | "macrolide"
  | "nsaid";

export type Prescription = {
  drug: string;
  dose: string;
  drugClass: DrugClass;
};

export type Vitals = {
  systolic: number;
  diastolic: number;
  hba1c?: number;
  weightKg: number;
  heartRate: number;
};

export type Visit = {
  id: string;
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
};

export type Allergy = {
  label: string;
  drugClass: DrugClass;
  recorded: string;
  severity: "severe" | "moderate";
};

export const patient = {
  name: "Priya Nair",
  age: 47,
  gender: "Female",
  id: "PT-2291",
  facility: "PHC Wagholi",
  district: "Pune",
  conditions: ["Type 2 diabetes", "Hypertension"],
  allergies: [
    {
      label: "Penicillin",
      drugClass: "penicillin",
      recorded: "02 Jun 2023",
      severity: "severe",
    },
  ] as Allergy[],
};

/** Newest first. */
export const visits: Visit[] = [
  {
    id: "v-2026-08-12",
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
    date: "2023-06-02",
    display: "02 Jun 2023",
    facility: "PHC Wagholi",
    diagnosis: "Diabetes diagnosis, initial workup",
    notes: "Fasting glucose 156. Type 2 diabetes confirmed. Penicillin allergy recorded.",
    prescriptions: [{ drug: "Metformin", dose: "500mg", drugClass: "biguanide" }],
    vitals: { systolic: 150, diastolic: 92, hba1c: 7.9, weightKg: 68, heartRate: 88 },
  },
];

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
