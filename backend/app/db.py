"""
Three engines, one per database role.

This is the architectural centre of the project. `admin_engine` is authenticated
as `admin_role`, which holds no grant on `patients` or `visits`. A third,
`auth_engine`, can read only the `staff` table — it serves the login route,
which is reachable before anyone has proved who they are. A route that
tries to read an identified record over that connection fails at the database,
loudly — not because the handler chose not to, but because the permission was
never issued.

That means the separation survives our own mistakes. Adding a buggy query to
routers/admin.py cannot leak patient data; it can only raise.
"""

from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine

load_dotenv()


def _require(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"{name} is not set. Copy backend/.env.example to backend/.env and "
            "fill in both connection strings — see db/README.md."
        )
    return value


@lru_cache(maxsize=1)
def clinician_engine() -> Engine:
    """Reads and appends identified records. No UPDATE/DELETE grant."""
    return create_engine(
        _require("DATABASE_URL_CLINICIAN"),
        pool_pre_ping=True,
        pool_size=5,
    )


@lru_cache(maxsize=1)
def auth_engine() -> Engine:
    """Reads `staff`, and nothing else.

    A third role rather than a reuse of clinician_engine(). The login endpoint
    is the one route an unauthenticated stranger can reach, so it runs on the
    connection with the least to lose: SELECT on one table of usernames,
    bcrypt hashes and roles. See db/auth.sql for the full reasoning.
    """
    return create_engine(
        _require("DATABASE_URL_AUTH"),
        pool_pre_ping=True,
        pool_size=3,
    )


@lru_cache(maxsize=1)
def admin_engine() -> Engine:
    """Aggregates only. Has no grant on patients or visits."""
    return create_engine(
        _require("DATABASE_URL_ADMIN"),
        pool_pre_ping=True,
        pool_size=5,
    )


def role_of(engine: Engine) -> str:
    """Which database role a connection is actually authenticated as.

    Exposed through /health so the separation is inspectable at runtime rather
    than merely asserted in a README.
    """
    with engine.connect() as conn:
        return conn.execute(text("SELECT current_user")).scalar_one()
