"""
The anomaly detector, tested on synthetic series with known answers.

These are pure-function tests — no database, no HTTP. The point is to pin down
behaviour that is easy to break and hard to notice, because the failure mode
is silence: a detector that stops detecting looks exactly like a quiet week.

The first test in particular guards a bug that was real, shipped in a first
draft, and passed every other check.
"""

from __future__ import annotations

import pytest

from app.routers.admin import STL_PERIOD, _stl_score

#: Roughly the Wagholi dengue series: steady around twelve, then a fivefold
#: jump in the most recent week.
SPIKE = [11, 16, 12, 12, 12, 16, 12, 14, 11, 12, 11, 14, 61]

#: Same series without the spike.
FLAT = [11, 16, 12, 12, 12, 16, 12, 14, 11, 12, 11, 14, 13]


def score(values: list[int]) -> float:
    result = _stl_score([float(v) for v in values])
    assert result is not None, "the decomposition failed to fit"
    return result


def test_terminal_spike_is_detected():
    """The regression test for the bug that made this endpoint useless.

    The obvious implementation fits STL across the whole series and reads the
    last residual. That silently fails on exactly this input: LOESS has no
    data to the right of the final point, so a terminal spike is absorbed into
    the trend. Measured on this series, full-series STL gave a final residual
    of -0.0 and a trend pulled from 12 up to 23.9 — a fivefold outbreak scored
    as perfectly ordinary, with no error and no warning.

    If this assertion ever fails, the fit has started including the week it is
    supposed to be scoring.
    """
    assert score(SPIKE) > 5, "a fivefold terminal spike was not flagged"


def test_quiet_series_is_not_flagged():
    assert abs(score(FLAT)) < 2


def test_steady_growth_does_not_alarm():
    """The property that makes this worth more than a ratio.

    A series climbing steadily is not an outbreak, but a ratio against a
    trailing mean fires on it every single week. The decomposition puts that
    climb in the trend, where it belongs, and leaves the residual small.
    """
    climbing = list(range(5, 5 + 13))
    assert abs(score(climbing)) < 2


def test_clean_data_does_not_produce_absurd_scores():
    """Guards the Poisson floor on the spread.

    Synthetic data is regular in a way real clinic data never is. Without a
    floor, the measured residual spread on a near-perfect series rounds to
    zero and the score divides by nothing — an early version returned 4e15 on
    the spike series and 1.8e4 on a flat one, which is not a detector.
    """
    almost_constant = [9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 9, 10]
    assert abs(score(almost_constant)) < 3


def test_scales_with_the_size_of_the_jump():
    """A bigger anomaly must score higher than a smaller one on the same base."""
    base = [10] * 12
    assert score(base + [15]) < score(base + [30]) < score(base + [60])


def test_too_short_a_series_returns_none():
    """The caller falls back rather than treating a failure as calm."""
    assert _stl_score([float(v) for v in [10] * (2 * STL_PERIOD - 1)]) is None


@pytest.mark.parametrize("value", [0, 1])
def test_a_collapse_scores_negative(value):
    """Direction matters: a drop is unusual too, but it is not an outbreak,
    and the router's threshold is one-sided for that reason."""
    assert score([20] * 12 + [value]) < 0
