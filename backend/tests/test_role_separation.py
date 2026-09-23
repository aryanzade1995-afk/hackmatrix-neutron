"""
The central claim, asserted rather than described.

Every test here goes straight to Postgres over the application's own engines
and asserts what the *database* does — not what a route handler chose to do.
That distinction is the entire point: the separation has to survive a bug in
our code, so the tests must not run through our code.

A failure in this file is not a broken test. It means db/schema.sql has been
applied incompletely or edited, and the project's main claim is no longer
true.
"""

from __future__ import annotations

import pytest
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from app.db import admin_engine, clinician_engine


def test_admin_cannot_read_patients():
    """The claim the whole dashboard rests on."""
    with pytest.raises(ProgrammingError) as exc:
        with admin_engine().connect() as conn:
            conn.execute(text("SELECT * FROM patients LIMIT 1")).all()
    assert "permission denied" in str(exc.value).lower()


def test_admin_cannot_read_visits():
    with pytest.raises(ProgrammingError) as exc:
        with admin_engine().connect() as conn:
            conn.execute(text("SELECT * FROM visits LIMIT 1")).all()
    assert "permission denied" in str(exc.value).lower()


def test_clinician_can_read_patients():
    """The other half: the separation must not have been achieved by breaking
    the clinician side."""
    with clinician_engine().connect() as conn:
        conn.execute(text("SELECT id FROM patients LIMIT 1")).all()


@pytest.mark.parametrize(
    "statement",
    [
        pytest.param(
            "UPDATE visits SET diagnosis = 'tampered' "
            "WHERE id = 'pytest-no-such-visit'",
            id="update",
        ),
        pytest.param(
            "DELETE FROM visits WHERE id = 'pytest-no-such-visit'", id="delete"
        ),
    ],
)
def test_clinician_cannot_modify_visits(statement):
    """Append-only, enforced by the absence of a grant.

    The WHERE clauses match no row on purpose. Postgres checks the privilege
    before it checks whether anything would be affected, so these raise
    without the test needing to risk a real row.

    Asserting on the message rather than just the exception type is what makes
    this a real test. The first version of it used `id = -1`, which raised
    ProgrammingError for an entirely different reason — `visits.id` is TEXT,
    so Postgres rejected the comparison before it ever considered the
    privilege. It passed, and proved nothing.
    """
    with pytest.raises(ProgrammingError) as exc:
        with clinician_engine().begin() as conn:
            conn.execute(text(statement))
    assert "permission denied" in str(exc.value).lower()


def test_neither_role_can_reach_staff():
    """Credentials are not the clinician's or the administrator's business.

    Guards the grant added in db/auth.sql — if someone later hands one of
    these roles blanket rights, this is what notices.
    """
    for engine in (clinician_engine(), admin_engine()):
        with pytest.raises(ProgrammingError) as exc:
            with engine.connect() as conn:
                conn.execute(text("SELECT username FROM staff LIMIT 1")).all()
        assert "permission denied" in str(exc.value).lower()
