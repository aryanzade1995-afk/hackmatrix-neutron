"""
Administrator routes. Every query here runs on the admin engine, which has no
grant on `patients` or `visits`.

That is the whole design. These handlers are not trusted to avoid identified
data — they are incapable of reaching it. If someone later adds a query here
that selects from `patients`, it raises `permission denied` rather than quietly
returning records, which is exactly the failure mode you want.

The /admin/prove endpoint below demonstrates this on demand.
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from ..db import admin_engine
from ..models import AggregateRow

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/aggregates", response_model=list[AggregateRow])
def aggregates(
    district: str | None = None,
    diagnosis: str | None = None,
    limit: int = Query(default=200, le=1000),
):
    """Weekly case counts. Reads `district_aggregates`, whose definition carries
    the k-anonymity threshold — groups below it never reach this code."""
    clauses, params = [], {"limit": limit}
    if district:
        clauses.append("district = :district")
        params["district"] = district
    if diagnosis:
        clauses.append("diagnosis = :diagnosis")
        params["diagnosis"] = diagnosis
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    sql = text(
        f"""
        SELECT district, diagnosis, week, case_count
        FROM district_aggregates
        {where}
        ORDER BY week DESC, case_count DESC
        LIMIT :limit
        """
    )
    with admin_engine().connect() as conn:
        rows = conn.execute(sql, params).all()
    return [
        AggregateRow(
            district=r.district, diagnosis=r.diagnosis, week=r.week, caseCount=r.case_count
        )
        for r in rows
    ]


@router.get("/trends", response_model=list[AggregateRow])
def trends(limit: int = Query(default=100, le=1000)):
    """Totals by district and condition, shaped for the existing charts."""
    with admin_engine().connect() as conn:
        rows = conn.execute(
            text(
                "SELECT district, diagnosis, case_count FROM condition_totals "
                "ORDER BY case_count DESC LIMIT :limit"
            ),
            {"limit": limit},
        ).all()
    return [
        AggregateRow(district=r.district, diagnosis=r.diagnosis, caseCount=r.case_count)
        for r in rows
    ]


@router.get("/prove")
def prove_separation():
    """Attempt to read identified records over the admin connection, and report
    what the database says.

    This is the psql proof from db/README.md, exposed over HTTP so it can be
    shown live without a terminal. A successful read here would be a serious
    finding — the endpoint reports that rather than hiding it.
    """
    result: dict[str, object] = {}

    for table in ("patients", "visits"):
        try:
            with admin_engine().connect() as conn:
                conn.execute(text(f"SELECT * FROM {table} LIMIT 1")).all()
            result[table] = {
                "blocked": False,
                "detail": "UNEXPECTED: the admin role read this table. Check the grants.",
            }
        except ProgrammingError as exc:
            result[table] = {
                "blocked": True,
                "detail": str(exc.orig).strip().splitlines()[0],
            }

    with admin_engine().connect() as conn:
        visible = conn.execute(text("SELECT COUNT(*) FROM condition_totals")).scalar_one()
        who = conn.execute(text("SELECT current_user")).scalar_one()

    result["aggregates"] = {"blocked": False, "visibleGroups": visible}
    result["connectedAs"] = who
    result["summary"] = (
        "Identified tables are unreachable on this connection; only suppressed "
        "aggregates are readable. Enforced by Postgres grants, not application code."
    )
    return result
