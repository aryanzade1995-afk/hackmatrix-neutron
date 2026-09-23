"""
Sign in, sign out, and "who am I".

Every query here runs on `auth_engine`, which holds SELECT on `staff` and no
grant on anything else. That is deliberate: these are the only routes a
stranger can reach before proving anything, so they run on the connection with
the least to lose. See db/auth.sql.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, Response
from fastapi import Cookie
from sqlalchemy import text

from ..auth import (
    SESSION_COOKIE,
    TOKEN_TTL,
    create_token,
    decode_token,
    verify_password,
)
from ..db import auth_engine
from ..models import LoginRequest, LoginResponse, MeResponse

router = APIRouter(prefix="/auth", tags=["auth"])

#: One message for every failed login. See the note in `login()`.
BAD_CREDENTIALS = "Invalid username or password"


def _cookie_is_secure() -> bool:
    """`secure=True` requires https, which the demo does not have.

    Driven by an env var rather than hardcoded so that deploying over https is
    a config change rather than a code change someone has to remember. It
    defaults to off because the demo runs on http://localhost — a `secure`
    cookie there is simply never sent, and the symptom is a login that appears
    to succeed and then immediately forgets you.
    """
    return (os.getenv("AUTH_COOKIE_SECURE") or "").strip().lower() in {"1", "true", "yes"}


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, response: Response):
    """Check the password, set the session cookie.

    The same message comes back whether the username does not exist or the
    password was wrong. Distinguishing them turns the login form into a
    directory: an attacker learns which usernames are real, which is the
    expensive half of guessing a credential pair.

    The password is still verified against a dummy hash when the username is
    unknown, so both paths cost the same bcrypt round. Returning early on an
    unknown user leaks the same fact through timing that the shared message
    was written to hide.
    """
    with auth_engine().connect() as conn:
        row = conn.execute(
            text("SELECT username, password_hash, role FROM staff WHERE username = :u"),
            {"u": body.username.strip().lower()},
        ).one_or_none()

    #: A real bcrypt hash of a value nobody holds, used only to burn the same
    #: CPU on the unknown-user path.
    DUMMY = "$2b$12$C6UzMDM.H6dfI/f/IKcEe.aB1F0SQJ5xO5s5B0d3JRtHmKzEKV5Aq"

    if row is None:
        verify_password(body.password, DUMMY)
        raise HTTPException(status_code=401, detail=BAD_CREDENTIALS)

    if not verify_password(body.password, row.password_hash):
        raise HTTPException(status_code=401, detail=BAD_CREDENTIALS)

    response.set_cookie(
        key=SESSION_COOKIE,
        value=create_token(row.username, row.role),
        httponly=True,       # unreadable from page scripts, so XSS cannot lift it
        samesite="lax",
        secure=_cookie_is_secure(),
        max_age=int(TOKEN_TTL.total_seconds()),
        path="/",
    )
    return LoginResponse(role=row.role, username=row.username)


@router.get("/me", response_model=MeResponse)
def me(hm_session: str | None = Cookie(default=None)):
    """The current session, or 401. The frontend's route guards read this."""
    if not hm_session:
        raise HTTPException(status_code=401, detail="Not signed in")
    try:
        payload = decode_token(hm_session)
    except Exception:
        raise HTTPException(status_code=401, detail="Session invalid or expired")
    return MeResponse(username=payload["sub"], role=payload["role"])


@router.post("/logout")
def logout(response: Response):
    """Clears the cookie.

    `delete_cookie` has to be given the same path the cookie was set with, or
    the browser keeps the original and the user stays signed in.
    """
    response.delete_cookie(key=SESSION_COOKIE, path="/")
    return {"detail": "Signed out"}
