"""
Hash chain for the access log.

Each row's hash commits to the previous row's hash plus its own fields, so
altering any entry breaks every hash after it. That is the whole tamper-evidence
claim, and `GET /clinician/access-log/verify` makes it checkable rather than
asserted — the same idea as `GET /admin/prove` for the role separation.

Concurrency uses a Postgres advisory lock rather than locking the last row.
`SELECT ... FOR UPDATE ORDER BY id DESC LIMIT 1` is the more obvious approach
but behaves poorly under concurrent inserts, because two transactions can read
the same tail before either commits. A fixed advisory key serialises chain
appends cleanly and releases at transaction end without any explicit unlock.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone


def canonical_time(value: datetime | str) -> str:
    """Normalise a timestamp to UTC ISO-8601 before it is hashed.

    This matters more than it looks. Postgres returns TIMESTAMPTZ in the
    session's timezone, so a server set to Asia/Kolkata hands back
    "...+05:30" while the value hashed on insert was "...+00:00". Same
    instant, different text, different digest — and the chain would appear
    tampered with on a server whose only crime was not running in UTC.
    """
    if isinstance(value, str):
        value = datetime.fromisoformat(value)
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()

#: First row's `prev_hash`. Sixty-four zeros, matching the sha256 hex width.
GENESIS = "0" * 64

#: Any constant works; it only has to be the same for every appender.
CHAIN_LOCK_KEY = "hackmatrix_access_log_chain"


def compute_hash(
    prev_hash: str,
    patient_id: str | None,
    actor: str,
    action: str,
    outcome: str,
    reason: str | None,
    created_at: str,
) -> str:
    """Deterministic over the row's content and its predecessor.

    `sort_keys` matters: verification recomputes this from stored columns, so
    the serialisation must not depend on dict ordering.
    """
    payload = json.dumps(
        {
            "prev": prev_hash,
            "patientId": patient_id,
            "actor": actor,
            "action": action,
            "outcome": outcome,
            "reason": reason,
            "at": created_at,
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()
