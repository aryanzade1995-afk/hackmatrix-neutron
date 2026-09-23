"""
The identity layer.

This is the check that sits *above* the database grants: who is asking. The
tests in test_role_separation.py prove the admin connection cannot reach a
patient record even with a valid session; these prove the routes refuse a
caller who has not proved who they are, or who has proved the wrong thing.

Both layers are asserted independently, on purpose. Either one failing is a
real regression, and neither result implies the other.
"""

from __future__ import annotations

import pytest

from app.auth import SESSION_COOKIE

#: One of each, so a change to a router's decorators cannot quietly unguard a
#: route that no test happens to name.
ADMIN_ROUTES = ["/admin/trends", "/admin/aggregates", "/admin/prove"]
CLINICIAN_ROUTES = ["/clinician/patients", "/clinician/access-log"]


# ---------------------------------------------------------------------------
# Logging in
# ---------------------------------------------------------------------------


def test_login_success_sets_session_cookie(anon_client, test_accounts):
    res = anon_client.post("/auth/login", json=test_accounts["clinician"])
    assert res.status_code == 200

    body = res.json()
    assert body["role"] == "clinician"
    assert body["username"] == test_accounts["clinician"]["username"]

    # The session must arrive as a cookie, not in the body — a token in the
    # response is a token JavaScript can read, and therefore one XSS can steal.
    assert SESSION_COOKIE in res.cookies
    assert "token" not in body and "access_token" not in body


def test_login_response_carries_no_password_material(anon_client, test_accounts):
    res = anon_client.post("/auth/login", json=test_accounts["admin"])
    text_body = res.text.lower()
    assert "hash" not in text_body
    assert test_accounts["admin"]["password"].lower() not in text_body


def test_wrong_password_and_unknown_user_are_indistinguishable(
    anon_client, test_accounts
):
    """The login form must not double as a directory of valid usernames."""
    wrong_pw = anon_client.post(
        "/auth/login",
        json={
            "username": test_accounts["clinician"]["username"],
            "password": "not-the-password",
        },
    )
    unknown = anon_client.post(
        "/auth/login",
        json={"username": "no.such.person", "password": "not-the-password"},
    )

    assert wrong_pw.status_code == 401
    assert unknown.status_code == 401
    assert wrong_pw.json() == unknown.json(), (
        "A wrong password and an unknown username returned different responses, "
        "which tells an attacker which usernames are real."
    )


def test_login_rejects_a_tampered_cookie(anon_client, test_accounts):
    """A session is only as good as its signature."""
    res = anon_client.post("/auth/login", json=test_accounts["admin"])
    good = res.cookies[SESSION_COOKIE]

    anon_client.cookies.set(SESSION_COOKIE, good[:-4] + "aaaa")
    assert anon_client.get("/admin/trends").status_code == 401
    anon_client.cookies.clear()


# ---------------------------------------------------------------------------
# Administrator routes
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("route", ADMIN_ROUTES)
def test_admin_route_rejects_no_session(anon_client, route):
    assert anon_client.get(route).status_code == 401


@pytest.mark.parametrize("route", ADMIN_ROUTES)
def test_admin_route_rejects_clinician_session(clinician_client, route):
    """403, not 401: they are signed in, just not as this."""
    assert clinician_client.get(route).status_code == 403


@pytest.mark.parametrize("route", ADMIN_ROUTES)
def test_admin_route_accepts_admin_session(admin_client, route):
    assert admin_client.get(route).status_code == 200


# ---------------------------------------------------------------------------
# Clinician routes — the mirror image
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("route", CLINICIAN_ROUTES)
def test_clinician_route_rejects_no_session(anon_client, route):
    assert anon_client.get(route).status_code == 401


@pytest.mark.parametrize("route", CLINICIAN_ROUTES)
def test_clinician_route_rejects_admin_session(admin_client, route):
    assert admin_client.get(route).status_code == 403


@pytest.mark.parametrize("route", CLINICIAN_ROUTES)
def test_clinician_route_accepts_clinician_session(clinician_client, route):
    assert clinician_client.get(route).status_code == 200


# ---------------------------------------------------------------------------
# Session lifecycle
# ---------------------------------------------------------------------------


def test_me_reports_the_signed_in_user(clinician_client, test_accounts):
    body = clinician_client.get("/auth/me").json()
    assert body == {
        "username": test_accounts["clinician"]["username"],
        "role": "clinician",
    }


def test_me_rejects_anonymous(anon_client):
    assert anon_client.get("/auth/me").status_code == 401


def test_logout_ends_the_session(client, test_accounts):
    client.cookies.clear()
    assert client.post("/auth/login", json=test_accounts["admin"]).status_code == 200
    assert client.get("/admin/trends").status_code == 200

    client.post("/auth/logout")
    assert client.get("/admin/trends").status_code == 401, (
        "The session survived logout."
    )
    client.cookies.clear()


def test_health_stays_public(anon_client):
    """Not everything is behind the wall, and that is intentional — /health is
    how you check the deployment before you can sign in to it."""
    assert anon_client.get("/health").status_code == 200
