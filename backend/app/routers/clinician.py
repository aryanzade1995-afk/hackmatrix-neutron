"""
Clinician routes. Every query here runs on the clinician engine, which holds
SELECT and INSERT on patients and visits — and deliberately not UPDATE or
DELETE, which is why there is no edit route below and could not usefully be one.
"""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text

from ..db import clinician_engine
from ..models import Patient, PatientCreate, Visit, VisitCreate

router = APIRouter(prefix="/clinician", tags=["clinician"])


def _patient_from_row(row) -> Patient:
    return Patient(
        id=row.id,
        name=row.name,
        dob=row.dob,
        gender=row.gender,
        phone=row.phone,
        facility=row.facility,
        district=row.district,
        conditions=list(row.conditions or []),
        allergies=row.allergies or [],
        registeredAt=row.registered_at,
    )


def _visit_from_row(row) -> Visit:
    return Visit(
        id=row.id,
        patientId=row.patient_id,
        date=row.visit_date,
        display=row.display_date,
        facility=row.facility,
        diagnosis=row.diagnosis,
        notes=row.notes,
        prescriptions=row.prescriptions or [],
        vitals=row.vitals or {},
        admission=row.admission,
        chiefComplaint=row.chief_complaint,
        symptomTags=list(row.symptom_tags) if row.symptom_tags else None,
        entryMethod=row.entry_method,
        supersedes=row.supersedes,
    )


@router.get("/patients", response_model=list[Patient])
def list_patients(limit: int = Query(default=500, le=2000)):
    """Every patient, for the frontend store to hold in memory.

    Fine at demo scale. A real deployment would paginate and push search to the
    server rather than shipping the roster to every client.
    """
    with clinician_engine().connect() as conn:
        rows = conn.execute(
            text("SELECT * FROM patients ORDER BY id LIMIT :limit"), {"limit": limit}
        ).all()
    return [_patient_from_row(r) for r in rows]


@router.get("/visits", response_model=list[Visit])
def list_visits(limit: int = Query(default=2000, le=5000)):
    """Every visit, newest first. Same caveat as list_patients."""
    with clinician_engine().connect() as conn:
        rows = conn.execute(
            text(
                "SELECT * FROM visits ORDER BY visit_date DESC, created_at DESC "
                "LIMIT :limit"
            ),
            {"limit": limit},
        ).all()
    return [_visit_from_row(r) for r in rows]


@router.get("/patients/search", response_model=list[Patient])
def search_patients(q: str = Query(min_length=1)):
    """Case-insensitive match on name, phone or id — same semantics as
    findPatientsByQuery in the frontend's clinical.ts."""
    needle = f"%{q.strip().lower()}%"
    sql = text(
        """
        SELECT * FROM patients
        WHERE lower(name) LIKE :needle
           OR lower(id) LIKE :needle
           OR lower(replace(coalesce(phone,''), ' ', '')) LIKE :phone_needle
        ORDER BY name
        LIMIT 25
        """
    )
    phone_needle = f"%{q.strip().lower().replace(' ', '')}%"
    with clinician_engine().connect() as conn:
        rows = conn.execute(sql, {"needle": needle, "phone_needle": phone_needle}).all()
    return [_patient_from_row(r) for r in rows]


@router.get("/patients/{patient_id}", response_model=Patient)
def get_patient(patient_id: str):
    with clinician_engine().connect() as conn:
        row = conn.execute(
            text("SELECT * FROM patients WHERE id = :id"), {"id": patient_id}
        ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No patient with that id")
    return _patient_from_row(row)


@router.get("/patients/{patient_id}/visits", response_model=list[Visit])
def get_visits(patient_id: str):
    with clinician_engine().connect() as conn:
        rows = conn.execute(
            text(
                "SELECT * FROM visits WHERE patient_id = :id "
                "ORDER BY visit_date DESC, created_at DESC"
            ),
            {"id": patient_id},
        ).all()
    return [_visit_from_row(r) for r in rows]


@router.post("/patients", response_model=Patient, status_code=201)
def create_patient(body: PatientCreate):
    """Assigns the next PT-#### id, matching nextPatientId in the frontend."""
    with clinician_engine().begin() as conn:
        if body.id:
            # The registration screen prints a QR encoding the id it generated,
            # so honour it rather than assigning a different one behind the
            # printed code.
            taken = conn.execute(
                text("SELECT 1 FROM patients WHERE id = :id"), {"id": body.id}
            ).one_or_none()
            if taken:
                raise HTTPException(
                    status_code=409, detail=f"Patient id {body.id} already exists"
                )
            new_id = body.id
        else:
            highest = conn.execute(
                text(
                    "SELECT COALESCE(MAX(NULLIF(regexp_replace(id,'\\D','','g'),'')::int), 0) "
                    "FROM patients WHERE id LIKE 'PT-%'"
                )
            ).scalar_one()
            new_id = f"PT-{int(highest) + 1}"

        conn.execute(
            text(
                """
                INSERT INTO patients
                  (id, name, dob, gender, phone, facility, district,
                   conditions, allergies, registered_at)
                VALUES
                  (:id, :name, :dob, :gender, :phone, :facility, :district,
                   :conditions, CAST(:allergies AS jsonb), CURRENT_DATE)
                """
            ),
            {
                "id": new_id,
                "name": body.name,
                "dob": body.dob,
                "gender": body.gender,
                "phone": body.phone,
                "facility": body.facility,
                "district": body.district,
                "conditions": body.conditions,
                "allergies": _json(body.allergies),
            },
        )
        row = conn.execute(
            text("SELECT * FROM patients WHERE id = :id"), {"id": new_id}
        ).one()
    return _patient_from_row(row)


@router.post("/visits", response_model=Visit, status_code=201)
def create_visit(body: VisitCreate):
    """Append a visit.

    There is no PUT, PATCH or DELETE counterpart, and there never should be:
    a correction is a new row carrying `supersedes`, and the clinician role
    holds no UPDATE grant to do otherwise.
    """
    visit_date = body.date or date.today()
    visit_id = body.id or f"v-{visit_date.isoformat()}-{body.patientId}-{_suffix()}"
    display = visit_date.strftime("%d %b %Y")

    with clinician_engine().begin() as conn:
        exists = conn.execute(
            text("SELECT 1 FROM patients WHERE id = :id"), {"id": body.patientId}
        ).one_or_none()
        if exists is None:
            raise HTTPException(status_code=404, detail="No patient with that id")

        conn.execute(
            text(
                """
                INSERT INTO visits
                  (id, patient_id, visit_date, display_date, facility, diagnosis,
                   notes, prescriptions, vitals, admission, chief_complaint,
                   symptom_tags, entry_method, supersedes)
                VALUES
                  (:id, :patient_id, :visit_date, :display_date, :facility, :diagnosis,
                   :notes, CAST(:prescriptions AS jsonb), CAST(:vitals AS jsonb),
                   :admission, :chief_complaint, :symptom_tags, :entry_method, :supersedes)
                """
            ),
            {
                "id": visit_id,
                "patient_id": body.patientId,
                "visit_date": visit_date,
                "display_date": display,
                "facility": body.facility,
                "diagnosis": body.diagnosis,
                "notes": body.notes,
                "prescriptions": _json(body.prescriptions),
                "vitals": _json(body.vitals),
                "admission": body.admission,
                "chief_complaint": body.chiefComplaint,
                "symptom_tags": body.symptomTags,
                "entry_method": body.entryMethod,
                "supersedes": body.supersedes,
            },
        )
        row = conn.execute(
            text("SELECT * FROM visits WHERE id = :id"), {"id": visit_id}
        ).one()
    return _visit_from_row(row)


def _json(value) -> str:
    import json

    from pydantic import BaseModel

    if isinstance(value, BaseModel):
        return value.model_dump_json(exclude_none=True)
    if isinstance(value, list):
        return json.dumps(
            [v.model_dump(exclude_none=True, mode="json") if isinstance(v, BaseModel) else v for v in value]
        )
    return json.dumps(value)


def _suffix() -> str:
    from uuid import uuid4

    return uuid4().hex[:8]
