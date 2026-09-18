"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/Badge";
import { Card, CardHeader, SectionLabel } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PatientContextBar } from "@/components/PatientContextBar";
import { useStore } from "@/lib/store";
import {
  ageFromDob,
  applicableComplaintsFor,
  findPatientById,
  lastPrescriptionForPatient,
  pastDiagnosesAt,
  topMedicinesForDiagnosis,
} from "@/lib/clinical";
import {
  chiefComplaints,
  DEFAULT_PATIENT_ID,
  FACILITIES,
  facilityFormulary,
  type MedicineOption,
  type Prescription,
  type Visit,
  clinicianTabs,
} from "@/lib/demo-data";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Plus,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";

const STEPS = [
  { n: "01", label: "Complaint" },
  { n: "02", label: "Diagnosis" },
  { n: "03", label: "Medicine" },
  { n: "04", label: "Review" },
];

const inputClass =
  "transition-calm w-full rounded-xl bg-canvas px-4 py-2.5 text-[13.5px] text-ink ring-1 ring-inset ring-border placeholder:text-ink-faint focus:outline-none focus:ring-border-strong";

export default function NewVisitPage() {
  return (
    <Suspense fallback={null}>
      <NewVisitFlow />
    </Suspense>
  );
}

function NewVisitFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { patients, visits, addVisit } = useStore();

  const patient =
    findPatientById(patients, searchParams.get("patient")) ??
    findPatientById(patients, DEFAULT_PATIENT_ID)!;

  const [step, setStep] = useState(1);
  const [complaintId, setComplaintId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [diagnosis, setDiagnosis] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [medicineQuery, setMedicineQuery] = useState("");
  const [customDrug, setCustomDrug] = useState("");
  const [customDose, setCustomDose] = useState("");
  const [facility, setFacility] = useState(patient.facility);
  const [detailOpen, setDetailOpen] = useState(false);
  const [vitals, setVitals] = useState({
    systolic: "",
    diastolic: "",
    weightKg: "",
    heartRate: "",
    hba1c: "",
  });
  const [notes, setNotes] = useState("");

  const isChild = ageFromDob(patient.dob) < 12;
  const complaints = useMemo(
    () => applicableComplaintsFor(patient, chiefComplaints),
    [patient],
  );
  const complaint = complaints.find((c) => c.id === complaintId) ?? null;

  const pastDiagnoses = useMemo(
    () => pastDiagnosesAt(visits, patient.facility),
    [visits, patient.facility],
  );
  const suggestions = pastDiagnoses.filter(
    (d) => diagnosis.trim() && d.toLowerCase().includes(diagnosis.trim().toLowerCase()),
  );

  const carryForward = useMemo(
    () => lastPrescriptionForPatient(visits, patient.id),
    [visits, patient.id],
  );
  const ranked = useMemo(
    () => topMedicinesForDiagnosis(visits, diagnosis, patient.facility),
    [visits, diagnosis, patient.facility],
  );
  const formulary = facilityFormulary[patient.facility] ?? [];
  const filteredFormulary = formulary.filter((m) =>
    m.drug.toLowerCase().includes(medicineQuery.trim().toLowerCase()),
  );

  /** Same rule as findAllergyConflicts: a shared drug class is a conflict.
   *  Prototype logic, not clinical decision support — it warns, never blocks. */
  function conflictFor(p: Prescription) {
    return patient.allergies.find((a) => a.drugClass === p.drugClass) ?? null;
  }
  const conflicts = prescriptions.filter((p) => conflictFor(p));

  const symptomTags = Object.values(answers).flat();

  function toggleAnswer(questionId: string, option: string, type: "single" | "multi") {
    setAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (type === "single") {
        return { ...prev, [questionId]: current[0] === option ? [] : [option] };
      }
      return {
        ...prev,
        [questionId]: current.includes(option)
          ? current.filter((v) => v !== option)
          : [...current, option],
      };
    });
  }

  function addMedicine(m: MedicineOption) {
    const dose = isChild && m.childDose ? m.childDose : m.adultDose;
    if (prescriptions.some((p) => p.drug === m.drug)) return;
    setPrescriptions((prev) => [...prev, { drug: m.drug, dose, drugClass: m.drugClass }]);
  }

  function addCustom() {
    if (!customDrug.trim()) return;
    setPrescriptions((prev) => [
      ...prev,
      {
        drug: customDrug.trim(),
        dose: customDose.trim() || "As directed",
        drugClass: "other",
      },
    ]);
    setCustomDrug("");
    setCustomDose("");
  }

  function save() {
    const today = new Date();
    const anyVital = Object.values(vitals).some((v) => v.trim() !== "");
    const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

    const visit: Visit = {
      id: `v-${today.toISOString().slice(0, 10)}-${patient.id}-${Date.now()}`,
      patientId: patient.id,
      date: today.toISOString().slice(0, 10),
      display: today.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      facility,
      diagnosis: diagnosis.trim(),
      notes: notes.trim(),
      prescriptions,
      vitals: {
        systolic: num(vitals.systolic),
        diastolic: num(vitals.diastolic),
        weightKg: num(vitals.weightKg),
        heartRate: num(vitals.heartRate),
        hba1c: num(vitals.hba1c),
      },
      chiefComplaint: complaint?.label,
      symptomTags: symptomTags.length > 0 ? symptomTags : undefined,
      entryMethod: anyVital || notes.trim() ? "detailed" : "quick",
    };

    addVisit(visit);
    router.push(`/clinician?patient=${patient.id}`);
  }

  const canAdvance =
    (step === 1 && Boolean(complaintId)) ||
    (step === 2 && diagnosis.trim().length > 0) ||
    step === 3 ||
    step === 4;

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      <PatientContextBar patient={patient} className="mb-6" />

      {/* Step indicator */}
      <ol className="mb-6 flex flex-wrap items-center gap-x-7 gap-y-2">
        {STEPS.map((s, i) => {
          const index = i + 1;
          const done = index < step;
          const active = index === step;
          return (
            <li key={s.n} className="flex items-center gap-2">
              <span
                className={`nums text-[11px] font-semibold ${
                  active ? "text-forest" : done ? "text-sage" : "text-ink-faint"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : s.n}
              </span>
              <span
                className={`text-[12.5px] ${
                  active ? "font-semibold text-ink" : "text-ink-faint"
                }`}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>

      {/* ---------------------------------------------------------- Step 1 */}
      {step === 1 && (
        <Card>
          <CardHeader
            title="What brought them in?"
            subtitle="Structured detail for the record and for district trends. This never suggests a diagnosis."
          />
          <div className="px-7 pb-7">
            <div className="flex flex-wrap gap-2">
              {complaints.map((c) => (
                <Chip
                  key={c.id}
                  label={c.label}
                  selected={complaintId === c.id}
                  onClick={() => {
                    setComplaintId(complaintId === c.id ? null : c.id);
                    setAnswers({});
                  }}
                />
              ))}
            </div>

            {complaint && complaint.followUps.length > 0 && (
              <div className="mt-7 space-y-6 border-t border-border pt-6">
                {complaint.followUps.map((q) => (
                  <div key={q.id}>
                    <SectionLabel>{q.prompt}</SectionLabel>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {q.options.map((opt) => (
                        <Chip
                          key={opt}
                          label={opt}
                          selected={(answers[q.id] ?? []).includes(opt)}
                          onClick={() => toggleAnswer(q.id, opt, q.type)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------------- Step 2 */}
      {step === 2 && (
        <Card>
          <CardHeader
            title="Diagnosis"
            subtitle="Your assessment, in your words. Suggestions below are only diagnoses already typed at this facility — they are not derived from the symptoms above."
          />
          <div className="px-7 pb-7">
            {complaint && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                <SectionLabel>Reported</SectionLabel>
                <Badge tone="sage">{complaint.label}</Badge>
                {symptomTags.map((t) => (
                  <Badge key={t} tone="neutral">
                    {t}
                  </Badge>
                ))}
              </div>
            )}

            <div className="relative max-w-xl">
              <input
                value={diagnosis}
                onChange={(e) => {
                  setDiagnosis(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                placeholder="Type a diagnosis"
                autoFocus
                className={inputClass}
              />
              {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-card-lift">
                  {suggestions.slice(0, 6).map((s) => (
                    <li key={s}>
                      <button
                        type="button"
                        onClick={() => {
                          setDiagnosis(s);
                          setShowSuggestions(false);
                        }}
                        className="transition-calm block w-full px-4 py-2.5 text-left text-[13.5px] text-ink-muted hover:bg-canvas hover:text-ink"
                      >
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-3 text-[12px] text-ink-faint">
              Anything can be typed here, including text not used before.
            </p>
          </div>
        </Card>
      )}

      {/* ---------------------------------------------------------- Step 3 */}
      {step === 3 && (
        <div className="space-y-6">
          {carryForward && (
            <Card tone="sage">
              <div className="px-7 py-6">
                <SectionLabel>Continue same as last time</SectionLabel>
                <p className="mt-2 text-[12.5px] text-ink-muted">
                  {carryForward.visit.display} · {carryForward.visit.diagnosis}
                </p>
                <div className="mt-3.5 flex flex-wrap items-center gap-2">
                  {carryForward.prescriptions.map((p) => (
                    <Badge key={p.drug} tone="neutral">
                      {p.drug} {p.dose}
                    </Badge>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setPrescriptions((prev) => {
                        const merged = [...prev];
                        for (const p of carryForward.prescriptions) {
                          if (!merged.some((m) => m.drug === p.drug)) merged.push(p);
                        }
                        return merged;
                      })
                    }
                    className="transition-calm inline-flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-1.5 text-[12.5px] font-semibold text-cream hover:bg-forest-deep"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Carry forward
                  </button>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Medicine"
              subtitle={
                diagnosis.trim()
                  ? `Most often prescribed for "${diagnosis.trim()}" at ${patient.facility} — by past frequency, not by recommendation.`
                  : `Stocked at ${patient.facility}.`
              }
            />
            <div className="px-7 pb-7">
              <div className="flex flex-wrap gap-2">
                {ranked.map((m) => (
                  <Chip
                    key={m.drug}
                    label={`${m.drug} · ${isChild && m.childDose ? m.childDose : m.adultDose}`}
                    selected={prescriptions.some((p) => p.drug === m.drug)}
                    onClick={() => addMedicine(m)}
                  />
                ))}
              </div>
              {isChild && (
                <p className="mt-3 text-[12px] text-ink-faint">
                  Paediatric doses shown — patient is under 12.
                </p>
              )}

              <div className="mt-7 border-t border-border pt-6">
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                  <input
                    value={medicineQuery}
                    onChange={(e) => setMedicineQuery(e.target.value)}
                    placeholder="Search the full formulary"
                    className={`${inputClass} pl-11`}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {filteredFormulary.map((m) => (
                    <Chip
                      key={m.drug}
                      label={m.drug}
                      selected={prescriptions.some((p) => p.drug === m.drug)}
                      onClick={() => addMedicine(m)}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-7 border-t border-border pt-6">
                <SectionLabel>Something else</SectionLabel>
                <div className="mt-3 flex flex-wrap gap-2.5">
                  <input
                    value={customDrug}
                    onChange={(e) => setCustomDrug(e.target.value)}
                    placeholder="Medicine name"
                    className={`${inputClass} max-w-[220px]`}
                  />
                  <input
                    value={customDose}
                    onChange={(e) => setCustomDose(e.target.value)}
                    placeholder="Dose"
                    className={`${inputClass} max-w-[140px]`}
                  />
                  <button
                    type="button"
                    onClick={addCustom}
                    className="transition-calm inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2 text-[13px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <PrescriptionList
            prescriptions={prescriptions}
            conflictFor={conflictFor}
            onRemove={(drug) =>
              setPrescriptions((prev) => prev.filter((p) => p.drug !== drug))
            }
          />
        </div>
      )}

      {/* ---------------------------------------------------------- Step 4 */}
      {step === 4 && (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Review" subtitle="Nothing is saved until you confirm." />
            <dl className="divide-y divide-border border-t border-border">
              <Row label="Reported">
                {complaint ? (
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone="sage">{complaint.label}</Badge>
                    {symptomTags.map((t) => (
                      <Badge key={t} tone="neutral">
                        {t}
                      </Badge>
                    ))}
                  </span>
                ) : (
                  <span className="text-ink-faint">Not recorded</span>
                )}
              </Row>
              <Row label="Diagnosis">
                {diagnosis.trim() || <span className="text-ink-faint">Not entered</span>}
              </Row>
              <Row label="Medicine">
                {prescriptions.length === 0 ? (
                  <span className="text-ink-faint">None prescribed</span>
                ) : (
                  <span className="flex flex-wrap gap-2">
                    {prescriptions.map((p) => (
                      <Badge
                        key={p.drug}
                        tone={conflictFor(p) ? "danger" : "neutral"}
                      >
                        {p.drug} {p.dose}
                      </Badge>
                    ))}
                  </span>
                )}
              </Row>
              <Row label="Date">
                <span className="nums">
                  {new Date().toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </Row>
              <Row label="Facility">
                <select
                  value={facility}
                  onChange={(e) => setFacility(e.target.value)}
                  className={`${inputClass} max-w-xs`}
                >
                  {FACILITIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Row>
            </dl>

            <div className="border-t border-border px-7 py-5">
              <button
                type="button"
                onClick={() => setDetailOpen((v) => !v)}
                className="transition-calm flex items-center gap-2 text-[13px] font-medium text-ink-muted hover:text-ink"
              >
                <ChevronDown
                  className={`transition-calm h-4 w-4 ${detailOpen ? "rotate-180" : ""}`}
                />
                Add detail — vitals and notes
                <span className="text-[12px] text-ink-faint">optional</span>
              </button>

              {detailOpen && (
                <div className="mt-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                    {(
                      [
                        ["systolic", "Systolic"],
                        ["diastolic", "Diastolic"],
                        ["weightKg", "Weight kg"],
                        ["heartRate", "Heart rate"],
                        ["hba1c", "HbA1c %"],
                      ] as const
                    ).map(([key, label]) => (
                      <label key={key} className="block">
                        <span className="text-[11.5px] text-ink-faint">{label}</span>
                        <input
                          inputMode="decimal"
                          value={vitals[key]}
                          onChange={(e) =>
                            setVitals((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                          className={`${inputClass} nums mt-1`}
                        />
                      </label>
                    ))}
                  </div>
                  <label className="block">
                    <span className="text-[11.5px] text-ink-faint">Notes</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      className={`${inputClass} mt-1 resize-y`}
                    />
                  </label>
                </div>
              )}
            </div>
          </Card>

          {conflicts.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-danger bg-danger-tint px-7 py-5">
              <div className="flex items-start gap-3.5">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="text-[14px] font-semibold text-danger">
                    Saving with a recorded allergy conflict
                  </p>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                    {conflicts.map((p) => p.drug).join(", ")} shares a drug class with an
                    allergy on file. This is a warning, not a block — the decision stays
                    yours.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => (step === 1 ? router.back() : setStep((s) => s - 1))}
          className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-[13.5px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? "Cancel" : "Back"}
        </button>

        {step < 4 ? (
          <button
            type="button"
            disabled={!canAdvance}
            onClick={() => setStep((s) => s + 1)}
            className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={save}
            disabled={!diagnosis.trim()}
            className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-4 w-4" />
            Save visit
          </button>
        )}
      </div>
    </AppShell>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-4 px-7 py-4">
      <dt className="w-24 shrink-0 text-[11.5px] text-ink-faint">{label}</dt>
      <dd className="min-w-0 flex-1 text-[13.5px] text-ink">{children}</dd>
    </div>
  );
}

function PrescriptionList({
  prescriptions,
  conflictFor,
  onRemove,
}: {
  prescriptions: Prescription[];
  conflictFor: (p: Prescription) => { label: string } | null;
  onRemove: (drug: string) => void;
}) {
  if (prescriptions.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="This prescription"
        subtitle="Checked against recorded allergies as you add."
      />
      <ul className="divide-y divide-border border-t border-border">
        {prescriptions.map((p) => {
          const clash = conflictFor(p);
          return (
            <li key={p.drug} className="flex items-center gap-4 px-7 py-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">
                  {p.drug} <span className="text-ink-muted">{p.dose}</span>
                </p>
                {clash && (
                  <p className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-danger">
                    <TriangleAlert className="h-3.5 w-3.5" />
                    Conflicts with recorded {clash.label} allergy
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(p.drug)}
                aria-label={`Remove ${p.drug}`}
                className="transition-calm rounded-lg p-1.5 text-ink-faint hover:bg-canvas hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
