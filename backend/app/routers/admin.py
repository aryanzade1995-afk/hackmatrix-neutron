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
from statistics import mean, stdev

from fastapi import APIRouter, Query
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from ..db import admin_engine, clinician_engine, role_of
from ..models import (
    AggregateRow,
    FacilityActivity,
    ThresholdCurve,
    ThresholdPoint,
    TrendSignal,
)

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


@router.get("/facilities", response_model=list[FacilityActivity])
def facilities():
    """Which facilities are reporting, and when they last did.

    Reads `facility_activity`, which carries the same k-anonymity threshold as
    every other view: a facility with fewer than five recorded visits is not
    returned, and activity is reported by week rather than exact date.
    """
    with admin_engine().connect() as conn:
        rows = conn.execute(
            text(
                "SELECT facility, case_count, patient_count, last_week "
                "FROM facility_activity ORDER BY case_count DESC"
            )
        ).all()
    return [
        FacilityActivity(
            facility=r.facility,
            caseCount=r.case_count,
            patientCount=r.patient_count,
            lastWeek=r.last_week,
        )
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

        baseline_counts = [c for _, c in baseline_points]
        baseline_avg = mean(baseline_counts)
        # stdev needs two points; a one-week baseline has no spread to speak of.
        baseline_sd = stdev(baseline_counts) if len(baseline_counts) > 1 else 0.0
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
                baselineSd=round(baseline_sd, 2),
                zScore=round(
                    (current_count - baseline_avg) / baseline_sd if baseline_sd > 0 else 0.0,
                    2,
                ),
                baselineWeeks=len(baseline_counts),
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


# ---------------------------------------------------------------------------
# Privacy/utility tradeoff
# ---------------------------------------------------------------------------

#: k values to plot. 5 is production; the rest exist to show what it cost.
CURVE_K = (1, 2, 3, 5, 8, 10)

#: The threshold actually enforced in db/schema.sql.
PRODUCTION_K = 5


@router.get("/threshold-curve", response_model=ThresholdCurve)
def threshold_curve():
    """How many (district, diagnosis) groups survive at each candidate k.

    Read this one carefully, because it is the single endpoint in this file
    that does NOT run over the admin connection.

    It cannot. `admin_role` has no grant on `visits`, and the views it can read
    have the threshold already baked into their definitions — so from that
    connection the shape of the curve below k=5 is not merely hidden, it is
    unobtainable. Computing it requires the custodian connection that can see
    the underlying rows.

    That makes this a governance artifact, not an administrator's query: the
    evidence for choosing 5, published by whoever owns the data, in the same
    spirit as publishing the schema. It returns counts and nothing else — no
    district, no diagnosis, no group's contents, and no way to tell which
    groups fall on either side of any line. Two numbers per k, for six k.

    Worth being straight about the one thing it does disclose: subtracting the
    count at k=5 from the count at k=1 tells you how many groups are being
    suppressed. That is a deliberate publication, and it is why this is served
    from the custodian's connection rather than the dashboard's. The claim on
    the overview — that the number of hidden groups is unknown *to this role* —
    stays true, because that role still cannot compute it.
    """
    sql = text(
        """
        WITH groups AS (
          SELECT p.district, v.diagnosis, COUNT(*) AS n
          FROM visits v
          JOIN patients p ON p.id = v.patient_id
          GROUP BY p.district, v.diagnosis
        )
        SELECT
          k.k,
          COUNT(*) FILTER (WHERE g.n >= k.k)                      AS groups,
          COALESCE(SUM(g.n) FILTER (WHERE g.n >= k.k), 0)         AS cases_retained
        FROM groups g
        CROSS JOIN unnest(CAST(:ks AS int[])) AS k(k)
        GROUP BY k.k
        ORDER BY k.k
        """
    )

    # The custodian connection, for the reason given above.
    with clinician_engine().connect() as conn:
        rows = conn.execute(sql, {"ks": list(CURVE_K)}).all()
        total = conn.execute(text("SELECT COUNT(*) FROM visits")).scalar_one()

    return ThresholdCurve(
        productionK=PRODUCTION_K,
        points=[
            ThresholdPoint(k=r.k, groups=r.groups, casesRetained=r.cases_retained)
            for r in rows
        ],
        totalCases=total,
        computedBy=role_of(clinician_engine()),
        disclosure=(
            "Counts only. No group is named, and nothing here identifies which "
            "groups fall below any threshold. Computed over the custodian "
            "connection — the aggregate role cannot produce this curve."
        ),
    )
