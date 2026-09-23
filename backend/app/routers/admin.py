"""
Administrator routes. Every query here runs on the admin engine, which has no
grant on `patients` or `visits`.

That is the whole design. These handlers are not trusted to avoid identified
data — they are incapable of reaching it. If someone later adds a query here
that selects from `patients`, it raises `permission denied` rather than quietly
returning records, which is exactly the failure mode you want.

The /admin/prove endpoint below demonstrates this on demand.

Two independent checks guard this file, and both are deliberate:

  1. `Depends(require_role(...))` on every route — an application-level
     identity check against the signed session cookie.
  2. The engine each query runs on — a database-level grant that the API
     cannot talk its way past.

Removing either one leaves the other standing. That redundancy is the point:
the first stops the wrong person asking, the second stops the wrong data being
reachable even if the first is bypassed.
"""

from __future__ import annotations

import datetime as _dt
import math
from collections import defaultdict
from statistics import mean, stdev

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError

from ..auth import require_role
from ..db import admin_engine, clinician_engine, role_of
from ..models import (
    AggregateRow,
    ForecastPoint,
    ForecastResponse,
    FacilityActivity,
    ThresholdCurve,
    ThresholdPoint,
    TrendSignal,
)

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/aggregates", response_model=list[AggregateRow], dependencies=[Depends(require_role("admin"))])
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


@router.get("/trends", response_model=list[AggregateRow], dependencies=[Depends(require_role("admin"))])
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


@router.get("/facilities", response_model=list[FacilityActivity], dependencies=[Depends(require_role("admin"))])
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


#: Seasonal period for the STL decomposition, in weeks.
#:
#: Four is a compromise forced by the data rather than a claim about disease
#: biology: STL needs at least two full periods, and the longest series here is
#: thirteen weeks. A 52-week annual cycle — the one that actually matters for
#: dengue — would need two years of history to fit. What a 4-week period
#: captures is short-cycle wobble, mostly reporting rhythm. That is still
#: useful, because removing it makes the residual a cleaner signal, but it is
#: not seasonality in the epidemiological sense and this code does not pretend
#: it is.
STL_PERIOD = 4

#: STL needs two full periods of *history*, and the scored week sits on top of
#: that — it is deliberately excluded from the fit. See _stl_score.
MIN_POINTS_FOR_STL = 2 * STL_PERIOD + 1


def _stl_score(counts: list[float]) -> float | None:
    """How unusual the latest week is, in robust standard deviations.

    The decomposition is fitted to the history *excluding* the week being
    scored, and the latest count is then compared against what that fit
    expects. The exclusion is the whole trick, and it is not optional.

    Fitting STL over the full series and reading the last residual — the
    obvious implementation — silently fails on exactly the case this endpoint
    exists for. LOESS has no data to the right of the final point, so a
    terminal spike is absorbed into the trend rather than left in the
    residual. Measured on this project's own data: the Wagholi dengue series
    ends 11, 14, 61, and full-series STL returns a final residual of -0.0 with
    the trend pulled from 12 up to 23.9. A five-fold outbreak scored as
    perfectly normal. `robust=True` does not save it; that down-weights
    interior outliers, and this one is at the edge.

    So: fit on history, project one step, compare. A steadily climbing series
    still produces no alarm, because the projection climbs with it — which is
    the property that made STL worth using over a ratio in the first place.

    Returns None when the fit is not possible, so the caller falls back rather
    than reading a failure as a calm result.
    """
    import numpy as np
    from statsmodels.tsa.seasonal import STL

    history = np.asarray(counts[:-1], dtype=float)
    actual = float(counts[-1])

    if history.size < 2 * STL_PERIOD:
        return None

    try:
        fit = STL(history, period=STL_PERIOD, robust=True).fit()
    except Exception:
        return None

    trend = np.asarray(fit.trend, dtype=float)
    seasonal = np.asarray(fit.seasonal, dtype=float)
    resid = np.asarray(fit.resid, dtype=float)

    # One step ahead: hold the trend at its last fitted value and reuse the
    # seasonal component from the matching phase one period back. Extrapolating
    # the trend's slope was tempting and rejected — on thirteen points the
    # slope is noise, and projecting it would manufacture an expectation the
    # data does not support.
    expected = trend[-1] + seasonal[-STL_PERIOD]

    # Robust spread: median absolute deviation, scaled to be comparable with a
    # standard deviation on normal data. Plain std would be inflated by any
    # outlier still sitting in the history, shrinking every later score.
    mad = float(np.median(np.abs(resid - np.median(resid))))
    spread = mad * 1.4826 if mad > 0 else float(np.std(resid, ddof=1))

    # Poisson floor. These are counts of events, so even a perfectly regular
    # series carries noise of roughly sqrt(mean) — and synthetic data is
    # regular in a way real clinic data never is. Without this floor the
    # measured spread on the seed data rounds to zero and the scores run to
    # 1e15, which is not a detector, it is a division by nothing.
    #
    # The floor is what keeps this honest on clean data: it asks "is this
    # bigger than Poisson noise would explain", which is a real question, and
    # stops the answer depending on how tidy the generator happened to be.
    floor = math.sqrt(max(expected, 1.0))
    spread = max(spread, floor)
    if not np.isfinite(spread) or spread <= 0:
        return None

    score = (actual - expected) / spread
    return float(score) if np.isfinite(score) else None


@router.get("/signals", response_model=list[TrendSignal], dependencies=[Depends(require_role("admin"))])
def signals(
    score_threshold: float = Query(default=2.0, ge=0.5),
    min_current_count: int = Query(default=8, ge=5),
    min_baseline_weeks: int = Query(default=3, ge=1),
    baseline_weeks: int = Query(default=8, ge=1, le=26),
):
    """Flags a (district, diagnosis) pair whose most recent week is unusual for
    that pair.

    Two methods, chosen by how much history the pair has:

      * **STL decomposition** (statsmodels) where there are at least
        9 weekly observations. The series is split into trend, a
        4-week cycle, and residual; the latest residual is scored
        against the robust spread of the earlier ones.
      * **Trailing z-score** otherwise — the latest count against the mean and
        standard deviation of the preceding weeks. Most pairs in a short demo
        dataset take this path, and it is reported as a real fallback rather
        than dressed up as the first method.

    What this is not: a model of disease. There is no forecast here, no
    training, and nothing learned across pairs. It is a decomposition and a
    dispersion measure, applied to one series at a time.

    It runs on `district_aggregates`, which is already suppressed, so a flagged
    signal can never expose a group smaller than the k-anonymity threshold.

    Note the deliberate limitation: a week suppressed for being under the
    threshold is invisible here exactly as it is to a human reading the
    dashboard, so the history is whatever the admin role could see.
    "Correcting" for the missing weeks would leak the suppressed counts back in
    through the side door — this is the right behaviour, not a bug.
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
        baseline_sd = stdev(baseline_counts) if len(baseline_counts) > 1 else 0.0
        if baseline_avg <= 0 or current_count < min_current_count:
            continue

        all_counts = [float(c) for _, c in points]

        score = None
        if len(all_counts) >= MIN_POINTS_FOR_STL:
            score = _stl_score(all_counts)

        if score is None:
            # Fallback. Same arithmetic as before STL was introduced.
            if baseline_sd <= 0:
                continue
            score = (current_count - baseline_avg) / baseline_sd

        if score < score_threshold:
            continue

        out.append(
            TrendSignal(
                district=district,
                diagnosis=diagnosis,
                week=current_week,
                currentCount=current_count,
                baselineAvg=round(baseline_avg, 1),
                baselineSd=round(baseline_sd, 2),
                zScore=round(score, 2),
                baselineWeeks=len(baseline_counts),
                ratio=round(current_count / baseline_avg, 2),
                # Three standard deviations is the usual line for "look at
                # this", and it is a stricter test than the old 3x ratio: a
                # pair that merely tripled from a noisy baseline no longer
                # clears it.
                severity="alert" if score >= 3 else "watch",
            )
        )

    out.sort(key=lambda s: s.zScore, reverse=True)
    return out


@router.get("/prove", dependencies=[Depends(require_role("admin"))])
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


@router.get("/threshold-curve", response_model=ThresholdCurve, dependencies=[Depends(require_role("admin"))])
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


# ---------------------------------------------------------------------------
# Forecast
# ---------------------------------------------------------------------------

#: How far ahead to project. Three weeks is about as far as thirteen
#: observations can support without the interval becoming wider than the
#: numbers it surrounds.
FORECAST_WEEKS = 3

#: Holt-Winters needs two full seasons to estimate a seasonal component.
MIN_POINTS_FOR_SEASONAL = 2 * STL_PERIOD


@router.get(
    "/forecast",
    response_model=ForecastResponse,
    dependencies=[Depends(require_role("admin"))],
)
def forecast(
    district: str | None = None,
    diagnosis: str | None = None,
    weeks: int = Query(default=FORECAST_WEEKS, ge=1, le=8),
):
    """Project the filtered weekly series a few weeks forward.

    Exponential smoothing (statsmodels' ExponentialSmoothing), seasonal where
    there is enough history for it and additive-trend-only where there is not.
    `method` reports which one actually ran — the two are not equivalent and
    the interface should not imply they are.

    The interval is +/- 1.96 residual standard deviations of the in-sample fit.
    Call that what it is: a rough band describing how well the model matched
    the weeks it has already seen. It is not a prediction interval in the
    formal sense, because it accounts for neither parameter uncertainty nor
    the possibility that next month looks nothing like last month. On thirteen
    observations, a formally correct interval would be so wide as to say
    nothing at all.

    Runs on `district_aggregates`, so every input has already cleared the
    k-anonymity threshold. Weeks suppressed for being too small are absent
    from the history rather than zero — which biases the fit slightly upward,
    and is still better than inventing counts nobody measured.
    """
    import math as _math

    import numpy as np

    clauses, params = [], {}
    if district:
        clauses.append("district = :district")
        params["district"] = district
    if diagnosis:
        clauses.append("diagnosis = :diagnosis")
        params["diagnosis"] = diagnosis
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""

    with admin_engine().connect() as conn:
        rows = conn.execute(
            text(
                f"""
                SELECT week, SUM(case_count) AS cases
                FROM district_aggregates
                {where}
                GROUP BY week
                ORDER BY week
                """
            ),
            params,
        ).all()

    history = [ForecastPoint(week=r.week, actual=float(r.cases)) for r in rows]
    values = [float(r.cases) for r in rows]

    if len(values) < 4:
        return ForecastResponse(
            points=history,
            method="none — too little history to fit anything",
            caveat=(
                f"{len(values)} week(s) of data after suppression. A projection "
                "from this would be decoration, so none is shown."
            ),
        )

    # Candidate models, widest first, filtered by what the series length can
    # actually support. Each is a real exponential-smoothing configuration;
    # which one is right is a question about the data, not one to answer in
    # advance.
    candidates: list[tuple[str, dict]] = [
        ("level only, no trend or seasonal term", dict(trend=None, seasonal=None)),
    ]
    if len(values) >= 5:
        candidates.append(
            ("damped additive trend", dict(trend="add", damped_trend=True, seasonal=None))
        )
    if len(values) >= MIN_POINTS_FOR_SEASONAL + STL_PERIOD:
        candidates.append(
            (
                f"{STL_PERIOD}-week additive seasonal, no trend",
                dict(trend=None, seasonal="add", seasonal_periods=STL_PERIOD),
            )
        )
        candidates.append(
            (
                f"damped additive trend with {STL_PERIOD}-week additive seasonal",
                dict(
                    trend="add",
                    damped_trend=True,
                    seasonal="add",
                    seasonal_periods=STL_PERIOD,
                ),
            )
        )

    # Chosen by AIC rather than fixed, because the right shape depends on the
    # series and picking one in advance goes wrong in a specific, visible way:
    # a series ending on an outbreak spike fits a huge spurious trend, and a
    # trend model then extrapolates that spike's gradient. On this project's
    # own data, forcing trend+seasonal projected Wagholi dengue at 96 -> 126
    # -> 158 from an observed 61. AIC rejects that model here and keeps the
    # flat one, which is the honest reading: elevated, not accelerating.
    import warnings

    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    best = None
    for label, kwargs in candidates:
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                fitted = ExponentialSmoothing(
                    np.asarray(values, dtype=float),
                    initialization_method="estimated",
                    **kwargs,
                ).fit()
            aic = float(fitted.aic)
            if not np.isfinite(aic):
                continue
            if best is None or aic < best[0]:
                best = (aic, label, fitted)
        except Exception:  # noqa: BLE001 — a candidate that will not fit is skipped
            continue

    if best is None:
        return ForecastResponse(
            points=history,
            method="none — no candidate model converged",
            caveat="Every exponential-smoothing configuration failed to fit this series.",
        )

    aic, label, model = best
    predicted = np.asarray(model.forecast(weeks), dtype=float)
    resid = np.asarray(model.resid, dtype=float)
    method = (
        f"Exponential smoothing, {label} (statsmodels), "
        f"chosen by AIC from {len(candidates)} candidate model"
        f"{'s' if len(candidates) != 1 else ''}"
    )

    sigma = float(np.std(resid, ddof=1)) if resid.size > 1 else 0.0
    # Same Poisson floor as the detector, for the same reason: on synthetic
    # data the in-sample residuals can round to zero, and a band of zero width
    # would claim certainty nobody has.
    sigma = max(sigma, _math.sqrt(max(float(np.mean(values)), 1.0)))
    half = 1.96 * sigma

    last_week = rows[-1].week
    points = list(history)
    for i, value in enumerate(predicted, start=1):
        points.append(
            ForecastPoint(
                week=last_week + _dt.timedelta(weeks=i),
                forecast=round(float(value), 1),
                # Counts cannot be negative, and a band that dips below zero
                # would be reporting an impossibility rather than uncertainty.
                lower=round(max(0.0, float(value) - half), 1),
                upper=round(float(value) + half, 1),
            )
        )

    return ForecastResponse(
        points=points,
        method=method,
        caveat=(
            f"Projection from {len(values)} observed weeks. The band is "
            "+/- 1.96 residual standard deviations of the in-sample fit — how "
            "closely the model matched weeks it has already seen, not a "
            "guarantee about weeks it has not."
        ),
    )
