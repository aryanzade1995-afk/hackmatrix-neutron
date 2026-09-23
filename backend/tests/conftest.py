"""
Shared fixtures.

These tests run against the *development* database, not a throwaway one. That
is a deliberate trade: the whole point of the suite is to assert facts about
real Postgres grants, and a mock or a SQLite stand-in would assert nothing —
the grants are the feature. A test that passes against a fake database would
be worse than no test, because it would look like proof.

The cost of that choice is handled two ways:

  * Nothing here writes to a table the application owns. The only rows created
    are a temporary `staff` account, removed in the fixture's teardown.
  * A guard refuses to run at all unless the target database is named
    `hackmatrix`. Cheap insurance against someone pointing DATABASE_URL_* at
    something real and running pytest out of habit.
"""

from __future__ import annotations

import os
import sys
import uuid
from pathlib import Path

import pytest
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# The app is imported as `app.*`, so `backend/` has to be on the path when
# pytest is invoked from the repository root.
BACKEND = Path(__file__).resolve().parents[1]
if str(BACKEND) not in sys.path:
    sys.path.insert(0, str(BACKEND))

load_dotenv(BACKEND / ".env")

#: The only database these tests will touch.
EXPECTED_DB_NAME = "hackmatrix"


def _database_name(url: str) -> str:
    """The database name out of a SQLAlchemy URL, whichever form it takes.

    Both shapes appear in this project: `.../hackmatrix` and the socket form
    `...://user@/hackmatrix?host=/tmp/...`.
    """
    from sqlalchemy.engine import make_url

    return make_url(url).database or ""


def pytest_collection_modifyitems(config, items):
    """Abort the whole run if pointed anywhere but the dev database."""
    url = os.getenv("DATABASE_URL_CLINICIAN")
    if not url:
        pytest.exit(
            "DATABASE_URL_CLINICIAN is not set. Copy backend/.env.example to "
            "backend/.env first — see db/README.md.",
            returncode=2,
        )
    name = _database_name(url)
    if name != EXPECTED_DB_NAME:
        pytest.exit(
            f"Refusing to run: DATABASE_URL_CLINICIAN points at '{name}', not "
            f"'{EXPECTED_DB_NAME}'. These tests read real tables and create a "
            "temporary staff account; they are not safe to aim at anything "
            "you care about.",
            returncode=2,
        )


def superuser_url() -> str:
    """A connection that can write to `staff`.

    auth_role holds SELECT only — by design — so creating the test account
    needs the owner. Derived from the clinician URL so there is one place to
    configure the cluster.
    """
    explicit = os.getenv("DATABASE_URL_SUPERUSER")
    if explicit:
        return explicit
    base = os.environ["DATABASE_URL_CLINICIAN"]
    scheme, _, rest = base.partition("://")
    _, _, after_at = rest.partition("@")
    return f"{scheme}://postgres@{after_at}"


@pytest.fixture(scope="session")
def client():
    """A TestClient over the real app, with its real dependencies."""
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def test_accounts():
    """Two throwaway staff accounts, removed afterwards.

    Deliberately not the seeded `dr.deshmukh` / `k.iyer` rows: those carry
    passwords chosen by whoever ran db/seed_staff.py, which the suite has no
    way to know and should not be storing anywhere if it did.

    Usernames are suffixed with a uuid so a crashed run cannot collide with
    the next one, and so these are never mistaken for real accounts.
    """
    from app.auth import hash_password

    suffix = uuid.uuid4().hex[:8]
    accounts = {
        "clinician": {"username": f"pytest.clin.{suffix}", "password": f"pw-{suffix}-C"},
        "admin": {"username": f"pytest.adm.{suffix}", "password": f"pw-{suffix}-A"},
    }

    engine = create_engine(superuser_url())
    with engine.begin() as conn:
        for role, acct in accounts.items():
            conn.execute(
                text(
                    "INSERT INTO staff (username, password_hash, role) "
                    "VALUES (:u, :h, :r)"
                ),
                {
                    "u": acct["username"],
                    "h": hash_password(acct["password"]),
                    "r": role,
                },
            )

    yield accounts

    # Teardown runs even if tests failed, so the table is left as it was found.
    with engine.begin() as conn:
        conn.execute(
            text("DELETE FROM staff WHERE username = ANY(:names)"),
            {"names": [a["username"] for a in accounts.values()]},
        )
    engine.dispose()


@pytest.fixture
def clinician_client(client, test_accounts):
    """A TestClient holding a signed-in clinician session."""
    res = client.post("/auth/login", json=test_accounts["clinician"])
    assert res.status_code == 200, res.text
    yield client
    client.cookies.clear()


@pytest.fixture
def admin_client(client, test_accounts):
    """A TestClient holding a signed-in administrator session."""
    res = client.post("/auth/login", json=test_accounts["admin"])
    assert res.status_code == 200, res.text
    yield client
    client.cookies.clear()


@pytest.fixture
def anon_client(client):
    """A TestClient with no session at all."""
    client.cookies.clear()
    yield client
