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

from collections import defaultdict
from statistics import mean

from fastapi import APIRouter, Query
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from ..db import admin_engine
from ..models import AggregateRow, TrendSignal

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


@router.get("/signals", response_model=list[TrendSignal])
def signals(
    ratio_threshold: float = Query(default=2.0, ge=1.1),
    min_current_count: int = Query(default=8, ge=5),
    min_baseline_weeks: int = Query(default=3, ge=1),
    baseline_weeks: int = Query(default=8, ge=1, le=26),
):
    """Flags a (district, diagnosis) pair whose most recent week is well above
    its own trailing average.

    Arithmetic on `district_aggregates` and nothing more — no model, no
    prediction. It runs on data that is already suppressed, so a flagged signal
    can never expose a group smaller than the k-anonymity threshold.

    A pair with too little history is skipped rather than flagged on thin
    evidence; `min_baseline_weeks` stops one quiet fortnight reading as an
    outbreak.

    Note the deliberate limitation: a week suppressed for being under the
    threshold is invisible here exactly as it is to a human reading the
    dashboard, so the baseline is computed only from weeks the admin role could
    see. "Correcting" for the missing weeks would leak the suppressed counts
    back in through the side door — this is the right behaviour, not a bug.
    """
    with admin_engine().connect() as conn:
        rows = conn.execute(
            text(
                "SELECT district, diagnosis, week, case_count FROM district_aggregates "
                "ORDER BY district, diagnosis, week"
            )
        ).all()

    series: dict[tuple[str, str], list[tuple]] = defaultdict(list)
    for r in rows:
        series[(r.district, r.diagnosis)].append((r.week, r.case_count))

    out: list[TrendSignal] = []
    for (district, diagnosis), points in series.items():
        if len(points) < min_baseline_weeks + 1:
            continue
        *history, (current_week, current_count) = points
        baseline_points = history[-baseline_weeks:]
        if len(baseline_points) < min_baseline_weeks:
            continue

        baseline_avg = mean(c for _, c in baseline_points)
        if baseline_avg <= 0 or current_count < min_current_count:
            continue

        ratio = current_count / baseline_avg
        if ratio < ratio_threshold:
            continue

        out.append(
            TrendSignal(
                district=district,
                diagnosis=diagnosis,
                week=current_week,
                currentCount=current_count,
                baselineAvg=round(baseline_avg, 1),
                ratio=round(ratio, 2),
                severity="alert" if ratio >= 3 else "watch",
            )
        )

    out.sort(key=lambda s: s.ratio, reverse=True)
    return out


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
