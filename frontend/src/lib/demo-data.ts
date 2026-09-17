export const patient = {
  name: "Priya Nair",
  age: 47,
  gender: "Female",
  id: "PT-2291",
  facility: "PHC Wagholi",
  district: "Pune",
  allergies: ["Penicillin"],
  conditions: ["Type 2 diabetes", "Hypertension"],
};

export const visits = [
  {
    date: "12 Aug 2026",
    facility: "PHC Wagholi",
    diagnosis: "Routine diabetes follow-up",
    prescription: "Metformin 500mg",
    notes: "HbA1c stable at 6.8. Continue current dose, review in six months.",
  },
  {
    date: "03 Mar 2026",
    facility: "District Hospital Pune",
    diagnosis: "Hypertensive episode, ER admission",
    prescription: "Amlodipine 5mg",
    notes: "Presented with BP 178/104. Stabilised overnight, discharged next morning.",
  },
  {
    date: "17 Nov 2025",
    facility: "PHC Wagholi",
    diagnosis: "Hypertensive episode, ER admission",
    prescription: "Amlodipine 5mg",
    notes: "Second hypertensive episode. Started on amlodipine.",
  },
  {
    date: "02 Jun 2023",
    facility: "PHC Wagholi",
    diagnosis: "Diabetes diagnosis, initial workup",
    prescription: "Metformin 500mg",
    notes: "Fasting glucose 156. Type 2 diabetes confirmed. Penicillin allergy recorded.",
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
