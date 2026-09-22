"""
Pydantic schemas mirroring the TypeScript types in the frontend field-for-field,
so the API returns JSON the existing pages already know how to render:

    demo-data.ts    Patient, Visit, Allergy, Vitals
    prescribing.ts  Prescription, Frequency
    formulary.ts    DoseForm, Route, FoodTiming

Field names stay camelCase on the wire even though the database columns are
snake_case — the frontend is the consumer, and changing its types was explicitly
not worth doing.
"""

from __future__ import annotations

import datetime as _dt
from typing import Literal

# Aliased: `Visit` has a field called `date`, which would otherwise shadow the
# type and break annotation evaluation.
Date = _dt.date

from pydantic import BaseModel, ConfigDict, Field

Gender = Literal["Female", "Male", "Other"]
DrugClass = Literal[
    "penicillin", "biguanide", "calcium-channel-blocker", "macrolide", "nsaid", "other"
]
DoseForm = Literal[
    "Tablet", "Capsule", "Syrup", "Injection", "Inhaler", "Drops", "Ointment", "Sachet"
]
Route = Literal["Oral", "Topical", "Inhaled", "IM", "IV", "Ophthalmic"]
FoodTiming = Literal["Before food", "After food", "With food", "Any time"]
EntryMethod = Literal["quick", "detailed"]


class Allergy(BaseModel):
    label: str
    drugClass: DrugClass
    recorded: str
    severity: Literal["severe", "moderate"]


class Frequency(BaseModel):
    """Positional dosing — 1-0-1 is morning, midday, night."""

    morning: float = 0
    afternoon: float = 0
    night: float = 0
    asNeeded: bool | None = None


class Prescription(BaseModel):
    drug: str
    strength: str
    form: DoseForm
    route: Route
    frequency: Frequency
    food: FoodTiming
    durationDays: int | None = None
    quantity: int
    drugClass: DrugClass
    instruction: str | None = None


class Vitals(BaseModel):
    systolic: float | None = None
    diastolic: float | None = None
    hba1c: float | None = None
    weightKg: float | None = None
    heartRate: float | None = None


class Patient(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    name: str
    dob: Date
    gender: Gender
    phone: str | None = None
    facility: str
    district: str
    conditions: list[str] = Field(default_factory=list)
    allergies: list[Allergy] = Field(default_factory=list)
    registeredAt: Date


class PatientCreate(BaseModel):
    """Body for POST /clinician/patients.

    `id` is optional. The server assigns the next PT-#### when it is omitted,
    but honours a client-supplied one if it is free — the registration screen
    prints a QR encoding the id it generated, so the two must agree. Two
    clients registering simultaneously could collide on the same id; the
    insert then fails on the primary key rather than silently overwriting.
    """

    id: str | None = None
    name: str
    dob: Date
    gender: Gender
    phone: str | None = None
    facility: str
    district: str
    conditions: list[str] = Field(default_factory=list)
    allergies: list[Allergy] = Field(default_factory=list)


class Visit(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    id: str
    patientId: str
    date: Date
    display: str
    facility: str
    diagnosis: str
    notes: str = ""
    prescriptions: list[Prescription] = Field(default_factory=list)
    vitals: Vitals = Field(default_factory=Vitals)
    admission: bool = False
    chiefComplaint: str | None = None
    symptomTags: list[str] | None = None
    entryMethod: EntryMethod | None = None
    supersedes: str | None = None


class VisitCreate(BaseModel):
    """Body for POST /clinician/visits — the server assigns id and display date.

    There is deliberately no VisitUpdate. Visits are append-only, and the
    clinician database role has no UPDATE grant, so one would not work anyway.
    """

    id: str | None = None
    patientId: str
    date: Date | None = None
    facility: str
    diagnosis: str
    notes: str = ""
    prescriptions: list[Prescription] = Field(default_factory=list)
    vitals: Vitals = Field(default_factory=Vitals)
    admission: bool = False
    chiefComplaint: str | None = None
    symptomTags: list[str] | None = None
    entryMethod: EntryMethod | None = None
    supersedes: str | None = None


class AggregateRow(BaseModel):
    """A row an administrator is allowed to see. Never carries an identifier."""

    district: str
    diagnosis: str
    caseCount: int
    week: Date | None = None


AccessAction = Literal["view_record", "emergency_access"]
AccessOutcome = Literal["granted", "denied"]


class AccessLogCreate(BaseModel):
    patientId: str | None = None
    actor: str
    action: AccessAction
    outcome: AccessOutcome = "granted"
    reason: str | None = None


class AccessLogEntry(BaseModel):
    id: int
    patientId: str | None
    actor: str
    action: AccessAction
    outcome: AccessOutcome
    reason: str | None
    prevHash: str
    hash: str
    createdAt: str


class FacilityActivity(BaseModel):
    """Aggregate only — a facility below the threshold is not returned at all."""

    facility: str
    caseCount: int
    patientCount: int
    lastWeek: Date


class TrendSignal(BaseModel):
    """A (district, diagnosis) pair whose latest week sits well above its own
    trailing average. Arithmetic over already-suppressed aggregates — no model,
    no prediction, and no new privacy surface."""

    district: str
    diagnosis: str
    week: Date
    currentCount: int
    baselineAvg: float
    ratio: float
    severity: Literal["watch", "alert"]


class Health(BaseModel):
    status: str
    clinicianRole: str | None = None
    adminRole: str | None = None
    detail: str | None = None
