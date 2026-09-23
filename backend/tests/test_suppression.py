"""
The k-anonymity threshold, checked against ground truth.

The views claim that nothing below five cases reaches the administrator. These
tests verify that by computing the true counts over the custodian connection —
the one that can see the underlying rows — and comparing.

Reading both sides is what makes this a real check. Querying only the view and
asserting `case_count >= 5` would prove nothing: a view that filtered on the
wrong column, or dropped its HAVING clause entirely, could still return rows
that all happen to be large. The question is whether any *suppressed* group
leaked, and that can only be answered from outside the view.
"""

from __future__ import annotations

from sqlalchemy import text

from app.db import admin_engine, clinician_engine

#: The threshold written into db/schema.sql.
K = 5


def _true_counts(group_by_week: bool) -> dict[tuple, int]:
    """Real counts per group, over the connection that can see the rows.

    Mirrors the grouping in the view definitions exactly — including
    date_trunc('week', ...) — because a mismatch here would compare two
    different questions and pass for the wrong reason.
    """
    week_col = "date_trunc('week', v.visit_date)::date AS week," if group_by_week else ""
    week_grp = ", date_trunc('week', v.visit_date)" if group_by_week else ""

    sql = text(
        f"""
        SELECT p.district, v.diagnosis, {week_col} COUNT(*) AS n
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
        GROUP BY p.district, v.diagnosis{week_grp}
        """
    )
    with clinician_engine().connect() as conn:
        rows = conn.execute(sql).all()

    if group_by_week:
        return {(r.district, r.diagnosis, r.week): r.n for r in rows}
    return {(r.district, r.diagnosis): r.n for r in rows}


def test_condition_totals_never_below_threshold():
    truth = _true_counts(group_by_week=False)

    with admin_engine().connect() as conn:
        published = conn.execute(
            text("SELECT district, diagnosis, case_count FROM condition_totals")
        ).all()

    assert published, "condition_totals returned nothing — is the database seeded?"

    for row in published:
        key = (row.district, row.diagnosis)
        actual = truth.get(key)
        assert actual is not None, f"{key} is published but has no underlying rows"
        assert actual >= K, f"{key} was published with only {actual} cases (k={K})"
        # The published number must also be the true one — a view that
        # suppressed correctly but reported a rounded or stale count would
        # pass the check above while still being wrong.
        assert row.case_count == actual, f"{key}: published {row.case_count}, true {actual}"


def test_district_aggregates_never_below_threshold():
    truth = _true_counts(group_by_week=True)

    with admin_engine().connect() as conn:
        published = conn.execute(
            text("SELECT district, diagnosis, week, case_count FROM district_aggregates")
        ).all()

    assert published, "district_aggregates returned nothing — is the database seeded?"

    for row in published:
        key = (row.district, row.diagnosis, row.week)
        actual = truth.get(key)
        assert actual is not None, f"{key} is published but has no underlying rows"
        assert actual >= K, f"{key} was published with only {actual} cases (k={K})"
        assert row.case_count == actual, f"{key}: published {row.case_count}, true {actual}"


def test_suppression_actually_suppresses_something():
    """Guards against a vacuous pass.

    If every real group happened to be large, the tests above would pass
    against a view with no threshold at all. This asserts that groups below K
    exist in the data and that none of them are published — so the other two
    tests are testing something.
    """
    truth = _true_counts(group_by_week=True)
    below = {k for k, n in truth.items() if n < K}
    assert below, (
        "No group in the seed data falls below the threshold, so the "
        "suppression tests would pass even against an unfiltered view. "
        "Reseed with db/seed.sql and db/bulk.sql."
    )

    with admin_engine().connect() as conn:
        published = {
            (r.district, r.diagnosis, r.week)
            for r in conn.execute(
                text("SELECT district, diagnosis, week FROM district_aggregates")
            ).all()
        }

    leaked = below & published
    assert not leaked, f"{len(leaked)} sub-threshold group(s) reached the admin view: {sorted(leaked)[:3]}"
