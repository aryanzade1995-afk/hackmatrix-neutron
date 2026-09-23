"""
Clinician routes. Every query here runs on the clinician engine, which holds
SELECT and INSERT on patients and visits — and deliberately not UPDATE or
DELETE, which is why there is no edit route below and could not usefully be one.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import text

from ..audit import CHAIN_LOCK_KEY, GENESIS, canonical_time, compute_hash
from ..db import clinician_engine
from ..whatsapp import (
    WhatsAppError,
    normalise_phone,
    render_qr_png,
    send_qr,
)
from ..models import (
    AccessLogCreate,
    AccessLogEntry,
    Patient,
    PatientCreate,
    Visit,
    VisitCreate,
)

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


def _require_patient(patient_id: str):
    with clinician_engine().connect() as conn:
        row = conn.execute(
            text("SELECT * FROM patients WHERE id = :id"), {"id": patient_id}
        ).one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="No patient with that id")
    return row


@router.get(
    "/patients/{patient_id}/qr.png",
    responses={200: {"content": {"image/png": {}}}},
    response_class=Response,
)
def patient_qr_png(patient_id: str):
    """The patient's QR as a PNG.

    Exists because Twilio fetches media over HTTP rather than accepting an
    upload; the browser still draws its own copy for download and print. The
    payload is identical either way — the patient id, nothing clinical.

    The patient is looked up first so this 404s on an unknown id rather than
    cheerfully encoding whatever string was in the URL.
    """
    _require_patient(patient_id)
    try:
        png = render_qr_png(patient_id)
    except WhatsAppError as exc:
        raise HTTPException(status_code=exc.status, detail=exc.message) from exc

    return Response(
        content=png,
        media_type="image/png",
        headers={
            # Twilio may fetch this more than once per send, and the content is
            # a pure function of the id, so it is safe to cache. Not public:
            # an id is not a secret, but it is not billboard material either.
            "Cache-Control": "private, max-age=300",
            "Content-Disposition": f'inline; filename="{patient_id}-qr.png"',
        },
    )


@router.post("/patients/{patient_id}/send-qr")
def patient_send_qr(patient_id: str):
    """Send the QR to the patient over WhatsApp.

    Every failure path returns the real reason. The sandbox opt-in case in
    particular gets its own message, because it is the one that will bite
    during a demo and it looks exactly like a credentials problem if the error
    is generic.
    """
    row = _require_patient(patient_id)

    try:
        phone = normalise_phone(row.phone)
        result = send_qr(patient_id, phone)
    except WhatsAppError as exc:
        raise HTTPException(
            status_code=exc.status,
            detail={"message": exc.message, "twilioCode": exc.code},
        ) from exc

    return result


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


# ---------------------------------------------------------------- access log


def _entry_from_row(row) -> AccessLogEntry:
    return AccessLogEntry(
        id=row.id,
        patientId=row.patient_id,
        actor=row.actor,
        action=row.action,
        outcome=row.outcome,
        reason=row.reason,
        prevHash=row.prev_hash,
        hash=row.hash,
        createdAt=canonical_time(row.created_at),
    )


@router.post("/access-log", response_model=AccessLogEntry, status_code=201)
def log_access(body: AccessLogCreate):
    """Append one entry to the hash chain.

    Insert-only, like `visits` — and the clinician role holds no UPDATE grant
    on this table either, so an audit trail that could be quietly rewritten is
    not merely discouraged, it is unavailable.
    """
    if body.action == "emergency_access" and not (body.reason and body.reason.strip()):
        raise HTTPException(
            status_code=422, detail="A reason is required for emergency access"
        )

    with clinician_engine().begin() as conn:
        # Serialise appenders so two writers cannot read the same chain tail.
        conn.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
            {"key": CHAIN_LOCK_KEY},
        )

        last_hash = conn.execute(
            text("SELECT hash FROM access_log ORDER BY id DESC LIMIT 1")
        ).scalar_one_or_none()
        prev_hash = last_hash or GENESIS

        created_at = canonical_time(datetime.now(timezone.utc))
        new_hash = compute_hash(
            prev_hash,
            body.patientId,
            body.actor,
            body.action,
            body.outcome,
            body.reason,
            created_at,
        )

        row = conn.execute(
            text(
                """
                INSERT INTO access_log
                  (patient_id, actor, action, outcome, reason, prev_hash, hash, created_at)
                VALUES
                  (:patient_id, :actor, :action, :outcome, :reason, :prev_hash, :hash, :created_at)
                RETURNING *
                """
            ),
            {
                "patient_id": body.patientId,
                "actor": body.actor,
                "action": body.action,
                "outcome": body.outcome,
                "reason": body.reason,
                "prev_hash": prev_hash,
                "hash": new_hash,
                "created_at": created_at,
            },
        ).one()

    return _entry_from_row(row)


@router.get("/access-log", response_model=list[AccessLogEntry])
def list_access_log(
    patient_id: str | None = Query(default=None),
    limit: int = Query(default=200, le=1000),
):
    clauses, params = [], {"limit": limit}
    if patient_id:
        clauses.append("patient_id = :patient_id")
        params["patient_id"] = patient_id
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    with clinician_engine().connect() as conn:
        rows = conn.execute(
            text(f"SELECT * FROM access_log {where} ORDER BY id DESC LIMIT :limit"),
            params,
        ).all()
    return [_entry_from_row(r) for r in rows]


@router.get("/access-log/verify")
def verify_chain():
    """Recompute every hash from stored fields and report the first divergence.

    This is the tamper-evidence claim made checkable. An altered row changes its
    own hash, which no longer matches the `prev_hash` recorded by the row after
    it, so the break is located rather than merely detected.
    """
    with clinician_engine().connect() as conn:
        rows = conn.execute(text("SELECT * FROM access_log ORDER BY id")).all()

    expected_prev = GENESIS
    for r in rows:
        recomputed = compute_hash(
            expected_prev,
            r.patient_id,
            r.actor,
            r.action,
            r.outcome,
            r.reason,
            canonical_time(r.created_at),
        )
        if r.prev_hash != expected_prev or r.hash != recomputed:
            return {
                "valid": False,
                "brokenAtId": r.id,
                "rowsChecked": len(rows),
                "detail": "This entry no longer matches its recorded hash.",
            }
        expected_prev = r.hash

    return {"valid": True, "rowsChecked": len(rows)}


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
