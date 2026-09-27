from datetime import date

import pandas as pd

from dashboard.lib.check_review import SATURATED, SPARSE, profile, review_window, up_for_review
from dashboard.lib.trends import Snapshot


def _snapshot(day: int, **columns) -> Snapshot:
    return Snapshot(timestamp=date(2026, 9, day), df=pd.DataFrame(columns))


def _values(passing: int, failing: int) -> list:
    return [True] * passing + [False] * failing


def test_profile_ignores_blanks_and_normalises_case():
    result = profile(pd.Series(["True", "true", " TRUE ", None, "", "False"]))

    assert result.dominant == "true"
    assert result.share == 0.75
    assert result.outliers == 1
    assert result.fill == 4 / 6


def test_flags_columns_saturated_or_sparse_in_every_snapshot():
    blank = [None] * 99 + ["x"]
    snapshots = [
        _snapshot(1, converged=_values(99, 1), mixed=_values(50, 50), empty=blank, flipped=_values(99, 1)),
        _snapshot(2, converged=_values(98, 2), mixed=_values(60, 40), empty=blank, flipped=_values(80, 20)),
    ]

    flagged = up_for_review(snapshots, ["converged", "mixed", "empty", "flipped"]).set_index("check")

    assert flagged.to_dict("index") == {
        "converged": {"kind": SATURATED, "dominant": "true", "share_pct": 98.0, "fill_pct": 100.0, "outliers": 2},
        "empty": {"kind": SPARSE, "dominant": "x", "share_pct": 100.0, "fill_pct": 1.0, "outliers": 0},
    }


def test_column_missing_from_a_snapshot_is_not_flagged():
    snapshots = [_snapshot(1, converged=_values(99, 1)), _snapshot(2, other=_values(1, 1))]

    assert up_for_review(snapshots, ["converged"]).empty


def test_no_history_gives_empty_review_and_window():
    assert up_for_review([], ["a"]).empty
    assert review_window([]).snapshots == 0


def test_window_spans_oldest_to_newest():
    window = review_window([_snapshot(9), _snapshot(3), _snapshot(5)])

    assert (window.snapshots, window.first, window.last) == (3, date(2026, 9, 3), date(2026, 9, 9))
