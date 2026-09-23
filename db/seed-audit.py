#!/usr/bin/env python3
"""
Seed a realistic access log.

Why a script and not a .sql file: every row's hash commits to the row before
it, so entries inserted with plain INSERTs would carry made-up digests and the
first `Verify chain` on stage would correctly report a broken chain. These go
in through POST /clinician/access-log, which computes each hash the same way a
real access does. The chain that results is a real one.

    python3 db/seed-audit.py --reset                     # prompts for the password
    python3 db/seed-audit.py --reset --password 'secret'

The clinician routes require a session, so this signs in first with a real
staff account — the same credentials a person would use. It defaults to
dr.deshmukh; pass --username for another.

--reset exists because the access log is append-only by design: neither
application role holds a DELETE grant, so clearing it requires a Postgres
superuser. That is the point of the table, and the awkwardness here is the
feature working.
"""

from __future__ import annotations

import argparse
import getpass
import http.cookiejar
import json
import subprocess
import sys
import urllib.error
import urllib.request

API = "http://localhost:8000"

#: Every /clinician route now requires a session, so this script has to sign
#: in like anything else would. It holds the cookie for the duration of the
#: run and never writes it anywhere.
OPENER = urllib.request.build_opener(
    urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar())
)


def sign_in(username: str, password: str) -> None:
    body = json.dumps({"username": username, "password": password}).encode()
    req = urllib.request.Request(
        f"{API}/auth/login", data=body, headers={"Content-Type": "application/json"}
    )
    try:
        with OPENER.open(req) as res:
            role = json.load(res)["role"]
    except urllib.error.HTTPError as exc:
        if exc.code == 401:
            sys.exit("Sign-in failed: invalid username or password.")
        raise
    if role != "clinician":
        sys.exit(f"{username} holds the {role} role; this script needs a clinician.")

#: Ordinary work, a refusal, and a break-glass — the three shapes the log has
#: to be able to show. Ordered so the emergency access lands mid-chain, which
#: is where it is most visible in the block view.
ENTRIES = [
    ("BP-0001", "Dr. R. Deshmukh", "view_record", "granted", None),
    ("BP-0002", "Dr. R. Deshmukh", "view_record", "granted", None),
    ("BP-0004", "Dr. S. Kulkarni", "view_record", "granted", None),
    ("BP-0003", "Dr. A. Rao", "view_record", "denied", "consent token expired"),
    (
        "BP-0003",
        "Dr. A. Rao",
        "emergency_access",
        "granted",
        "unconscious patient, no attendant present",
    ),
    ("BP-0005", "Dr. S. Kulkarni", "view_record", "granted", None),
    ("BP-0006", "Dr. R. Deshmukh", "view_record", "granted", None),
    ("BP-0002", "Dr. A. Rao", "view_record", "denied", "no consent token presented"),
    ("BP-0004", "Dr. R. Deshmukh", "view_record", "granted", None),
]


def reset() -> None:
    """Clear the table over a superuser connection."""
    cmd = [
        "psql", "-h", "/tmp/hmsock", "-p", "55432", "-U", "postgres",
        "-d", "hackmatrix", "-c",
        "TRUNCATE access_log RESTART IDENTITY;",
    ]
    done = subprocess.run(cmd, capture_output=True, text=True)
    if done.returncode != 0:
        sys.exit(f"reset failed: {done.stderr.strip()}")
    print("cleared access_log")


def post(patient_id, actor, action, outcome, reason) -> None:
    body = json.dumps(
        {
            "patientId": patient_id,
            "actor": actor,
            "action": action,
            "outcome": outcome,
            "reason": reason,
        }
    ).encode()
    req = urllib.request.Request(
        f"{API}/clinician/access-log",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with OPENER.open(req) as res:
        entry = json.load(res)
    print(f"  #{entry['id']:>2}  {actor:<18} {action:<17} {outcome:<8} {entry['hash'][:12]}…")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="clear the log first")
    parser.add_argument("--username", default="dr.deshmukh")
    parser.add_argument("--password", help="prompted for if omitted")
    args = parser.parse_args()

    password = args.password or getpass.getpass(f"Password for {args.username}: ")
    sign_in(args.username, password)

    if args.reset:
        reset()

    print(f"appending {len(ENTRIES)} entries via {API}")
    for entry in ENTRIES:
        try:
            post(*entry)
        except urllib.error.URLError as exc:
            sys.exit(f"\nthe backend is not reachable at {API}: {exc}")

    with OPENER.open(f"{API}/clinician/access-log/verify") as res:
        verdict = json.load(res)
    print(f"\nverify → {verdict}")
    if not verdict.get("valid"):
        sys.exit("the seeded chain does not verify, which should not happen")


if __name__ == "__main__":
    main()
