"""
The lookup a QR scan depends on, and the audit route it writes to.

A patient QR encodes only an id, and the scan screen resolves it with
GET /clinician/patients/{id}. These tests pin the behaviour that screen relies
on. None of them writes a row: the audit-route test is the rejection path,
which answers before anything is inserted.
"""

from __future__ import annotations

KNOWN = "PT-2291"


def test_scan_lookup_finds_a_registered_patient(clinician_client):
    res = clinician_client.get(f"/clinician/patients/{KNOWN}")
    assert res.status_code == 200
    assert res.json()["id"] == KNOWN


def test_scan_lookup_ignores_case_and_surrounding_space(clinician_client):
    """A camera can read "pt-2291 "; it is still the same patient, and the
    response carries the canonical id the rest of the app routes by."""
    res = clinician_client.get("/clinician/patients/%20pt-2291%20")
    assert res.status_code == 200
    assert res.json()["id"] == KNOWN


def test_unknown_code_is_404_not_another_patient(clinician_client):
    res = clinician_client.get("/clinician/patients/PT-99999999")
    assert res.status_code == 404


def test_admin_cannot_resolve_a_patient_code(admin_client):
    assert admin_client.get(f"/clinician/patients/{KNOWN}").status_code == 403


def test_anonymous_cannot_resolve_a_patient_code(anon_client):
    assert anon_client.get(f"/clinician/patients/{KNOWN}").status_code == 401


def test_access_log_rejects_an_unknown_patient_cleanly(clinician_client):
    """An unknown id used to fail on the foreign key as an unhandled 500."""
    res = clinician_client.post(
        "/clinician/access-log",
        json={"patientId": "PT-99999999", "action": "view_record"},
    )
    assert res.status_code == 404


def test_emergency_access_needs_a_reason(clinician_client):
    res = clinician_client.post(
        "/clinician/access-log",
        json={"patientId": KNOWN, "action": "emergency_access", "reason": "  "},
    )
    assert res.status_code == 422
