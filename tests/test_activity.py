import pandas as pd

from dashboard.lib.activity import org_totals, repo_signals, snapshot_has_signals


def _row(**values) -> pd.Series:
    return pd.Series(values)


def test_repo_signals_are_grouped_formatted_and_skip_blanks():
    row = _row(**{
        "github.issues_open": 12,
        "github.issue_closure_ratio_90d": 0.4567,
        "github.median_issue_first_response_seconds": 5400,
        "github.oldest_open_pr_days": 1,
        "github.median_pr_time_to_merge_seconds": 3 * 86400,
        "github.default_branch_ci_state": "FAILURE",
        "github.first_timer_prs_90d": 0,
        "github.good_first_issues_open": None,
        "repo_name": "openedx/x",
    })

    assert repo_signals(row) == {
        "Issues": [("Open issues", "12"), ("Closed of those", "46%"), ("Median first response", "1.5 h")],
        "Pull requests": [("Oldest open PR", "1 day"), ("Median time to merge", "3.0 days"),
                          ("Default-branch CI", "Failure")],
        "Newcomers": [("First-timer PRs (90 days)", "0")],
    }


def test_repo_without_signal_columns_has_no_signals():
    assert repo_signals(_row(repo_name="openedx/x")) == {}
    assert not snapshot_has_signals(["repo_name", "github.last_push"])
    assert snapshot_has_signals(["github.prs_open"])


def test_org_totals_sum_counts_and_count_failing_ci():
    df = pd.DataFrame({
        "github.issues_open": [3, None, 4],
        "github.prs_open": [1, 2, 3],
        "github.default_branch_ci_state": ["SUCCESS", "FAILURE", "ERROR"],
    })

    assert org_totals(df) == ["7 open issues", "6 open PRs", "2 repos with failing default-branch CI"]


def test_org_totals_empty_without_columns():
    assert org_totals(pd.DataFrame({"repo_name": ["a"]})) == []
