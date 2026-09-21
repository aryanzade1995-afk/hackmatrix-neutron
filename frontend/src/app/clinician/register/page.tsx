"use client";

import { useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { Card, PageTitle, SectionLabel } from "@/components/Card";
import { Chip } from "@/components/Chip";
import { PatientQrPanel } from "@/components/PatientQrPanel";
import { nextPatientId } from "@/lib/clinical";
import { useStore } from "@/lib/store";
import {
  DISTRICTS,
  DRUG_CLASSES,
  FACILITIES,
  clinicianTabs,
  type Allergy,
  type DrugClass,
  type Patient,
} from "@/lib/demo-data";
import { ArrowRight, UserPlus } from "lucide-react";

const NONE = "None known";

const fieldClass =
  "transition-calm w-full rounded-xl bg-canvas px-4 py-2.5 text-[13.5px] text-ink ring-1 ring-inset ring-border placeholder:text-ink-faint focus:outline-none focus:ring-border-strong";

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12.5px] font-medium text-ink">{label}</span>
      {hint && <span className="ml-1.5 text-[12px] text-ink-faint">{hint}</span>}
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1.5 text-[12px] text-danger">{error}</p>}
    </label>
  );
}

export default function RegisterPage() {
  const { patients, addPatient } = useStore();

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState<Patient["gender"] | "">("");
  const [phone, setPhone] = useState("");
  const [facility, setFacility] = useState("");
  const [district, setDistrict] = useState("");
  const [allergyClasses, setAllergyClasses] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<Patient | null>(null);

  function toggleAllergy(value: string) {
    setAllergyClasses((prev) => {
      if (value === NONE) return prev.includes(NONE) ? [] : [NONE];
      const without = prev.filter((v) => v !== NONE);
      return without.includes(value)
        ? without.filter((v) => v !== value)
        : [...without, value];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const next: Record<string, string> = {};
    if (!name.trim()) next.name = "Enter the patient's full name";
    if (!dob) next.dob = "Date of birth is required";
    else if (new Date(dob) > new Date()) next.dob = "Date of birth cannot be in the future";
    if (!gender) next.gender = "Select a gender";
    if (!facility) next.facility = "Select the registering facility";
    if (!district) next.district = "Select a district";

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const allergies: Allergy[] = allergyClasses
      .filter((c): c is DrugClass => c !== NONE)
      .map((drugClass) => ({
        label: drugClass.replace(/-/g, " "),
        drugClass,
        recorded: new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }),
        severity: "moderate" as const,
      }));

    const patient: Patient = {
      id: nextPatientId(patients),
      name: name.trim(),
      dob,
      gender: gender as Patient["gender"],
      phone: phone.trim() || undefined,
      facility,
      district,
      conditions: [],
      allergies,
      registeredAt: new Date().toISOString().slice(0, 10),
    };

    addPatient(patient);
    setCreated(patient);
  }

  function reset() {
    setName("");
    setDob("");
    setGender("");
    setPhone("");
    setFacility("");
    setDistrict("");
    setAllergyClasses([]);
    setErrors({});
    setCreated(null);
  }

  return (
    <AppShell role="clinician" userName="Dr. R. Deshmukh" tabs={clinicianTabs}>
      <PageTitle
        eyebrow="New patient · happens once, ever"
        title="Register a patient"
        subtitle="This creates their permanent record and QR code. Every visit after this is logged separately."
      />

      {created ? (
        <Card className="max-w-3xl">
          <div className="px-7 py-7">
            <SectionLabel>Registered</SectionLabel>
            <h2 className="text-display mt-2 text-[22px] text-ink">
              {created.name} now has a record
            </h2>

            <PatientQrPanel
              patientId={created.id}
              patientName={created.name}
              className="mt-6"
            />

            <div className="mt-6 flex flex-wrap items-center gap-3 print:hidden">
              <Link
                href={`/clinician/visit/new?patient=${created.id}`}
                className="transition-calm inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep"
              >
                Record their first visit
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={reset}
                className="transition-calm inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-[13.5px] font-medium text-ink-muted hover:border-border-strong hover:text-ink"
              >
                <UserPlus className="h-4 w-4" />
                Register another patient
              </button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="max-w-3xl">
          <form onSubmit={handleSubmit} noValidate className="px-7 py-7">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label="Full name" error={errors.name}>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="As the patient gives it"
                    className={fieldClass}
                  />
                </Field>
              </div>

              <Field
                label="Date of birth"
                hint="age is calculated from this"
                error={errors.dob}
              >
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className={`${fieldClass} nums`}
                />
              </Field>

              <Field label="Gender" error={errors.gender}>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as Patient["gender"])}
                  className={fieldClass}
                >
                  <option value="">Select…</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </Field>

              <Field label="Phone number" hint="optional">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 …"
                  className={`${fieldClass} nums`}
                />
              </Field>

              <Field label="Facility" error={errors.facility}>
                <select
                  value={facility}
                  onChange={(e) => setFacility(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select…</option>
                  {FACILITIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="District" error={errors.district}>
                <select
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select…</option>
                  {DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-7 border-t border-border pt-6">
              <SectionLabel>Known allergies · optional</SectionLabel>
              <p className="mt-1.5 text-[12.5px] text-ink-muted">
                Recorded now so every later prescription can be checked against them.
              </p>
              <div className="mt-3.5 flex flex-wrap gap-2">
                {[...DRUG_CLASSES, NONE].map((value) => (
                  <Chip
                    key={value}
                    label={value === NONE ? NONE : value.replace(/-/g, " ")}
                    selected={allergyClasses.includes(value)}
                    onClick={() => toggleAllergy(value)}
                  />
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="transition-calm mt-7 inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-[13.5px] font-semibold text-cream hover:bg-forest-deep"
            >
              Generate QR code
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </Card>
      )}
    </AppShell>
  );
}
