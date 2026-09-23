"""
Identity: who is asking.

This is the second of two independent checks, and it is worth being precise
about the division of labour, because they are easy to confuse:

  * This module answers "who are you, and what role do you hold" — an
    application-level question, decided from a signed cookie.
  * db.py answers "what may this connection reach" — a database-level
    question, decided by Postgres grants that the API cannot talk its way past.

Neither substitutes for the other. Strip out every `require_role` below and
the admin routes still cannot read a patient record, because admin_role holds
no grant on that table. Grant admin_role SELECT on `patients` tomorrow and the
routes still refuse an anonymous caller, because the cookie check runs first.
Two locks, different keys.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Literal

import bcrypt
import jwt
from fastapi import Cookie, HTTPException

#: Name of the session cookie. One place, so the router and the tests agree.
SESSION_COOKIE = "hm_session"

#: A shift, roughly. Long enough not to log someone out mid-consultation,
#: short enough that a laptop left open overnight is not a standing session.
TOKEN_TTL = timedelta(hours=12)

ALGORITHM = "HS256"


def secret_key() -> str:
    """The signing key, read at call time rather than import time.

    Read lazily so tests and tooling can import this module without a
    configured environment; the failure still arrives the first time anyone
    actually tries to sign or verify.
    """
    key = (os.getenv("AUTH_SECRET_KEY") or "").strip()
    if not key:
        raise RuntimeError(
            "AUTH_SECRET_KEY is not set. Generate one with `openssl rand -hex 32` "
            "and put it in backend/.env. There is deliberately no default: a "
            "hardcoded key is the same as no signature, because anyone holding "
            "the source could mint themselves an admin session."
        )
    return key


# ---------------------------------------------------------------------------
# Passwords
# ---------------------------------------------------------------------------


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, password_hash: str) -> bool:
    """Constant-time by way of bcrypt's own comparison.

    Returns False rather than raising on a malformed stored hash: a corrupt row
    should fail the login, not 500 the endpoint and advertise that the row is
    interesting.
    """
    try:
        return bcrypt.checkpw(pw.encode(), password_hash.encode())
    except (ValueError, TypeError):
        return False


# ---------------------------------------------------------------------------
# Tokens
# ---------------------------------------------------------------------------


def create_token(username: str, role: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": username, "role": role, "iat": now, "exp": now + TOKEN_TTL},
        secret_key(),
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    """Verifies signature and expiry. Raises `jwt.PyJWTError` on any failure.

    `algorithms` is pinned to a single value on purpose. Accepting whatever the
    token's own header asks for is how the `alg: none` family of forgeries
    works — the attacker picks the algorithm, so the attacker picks "no
    signature required".
    """
    return jwt.decode(token, secret_key(), algorithms=[ALGORITHM])


# ---------------------------------------------------------------------------
# Route dependency
# ---------------------------------------------------------------------------


def require_role(role: Literal["clinician", "admin"]):
    """Dependency factory: this route needs a valid session holding `role`.

    401 and 403 are kept distinct because they mean different things to the
    frontend: 401 means "no usable session, send them to the login page", 403
    means "signed in, but not as this". Collapsing them would leave a clinician
    who wandered into /admin being bounced to a login form they have already
    completed.
    """

    def dependency(hm_session: str | None = Cookie(default=None)) -> dict:
        if not hm_session:
            raise HTTPException(status_code=401, detail="Not signed in")

        try:
            payload = decode_token(hm_session)
        except jwt.PyJWTError:
            # Expired, tampered with, or signed by a different key. The caller
            # is told the same thing in every case — which one it was is
            # information an attacker would like to have.
            raise HTTPException(status_code=401, detail="Session invalid or expired")

        if payload.get("role") != role:
            raise HTTPException(
                status_code=403,
                detail=f"This area requires the {role} role",
            )
        return payload

    return dependency
