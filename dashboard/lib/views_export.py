"""Page-ready JSON for the static frontend, one file per page.

Every number comes from the same ``dashboard.lib`` functions the Streamlit pages
call; this module only selects and serialises. Values stay raw (seconds, ratios,
ISO dates) and the frontend formats them.
"""
from __future__ import annotations

from dataclasses import asdict
from pathlib import Path
from typing import Any, Callable

import pandas as pd

from dashboard.lib import activity
from dashboard.lib.activity import SIGNALS, org_total_values, unmeasured_columns
from dashboard.lib.attention import needing_attention
from dashboard.lib.bulletin import generate_weekly_bulletin
from dashboard.lib.check_review import SATURATION_SHARE, SPARSE_FILL, review_window, up_for_review
from dashboard.lib.checks import (
    CATEGORY_GROUPS,
    catalog_groups,
    category_columns,
    category_pass_rates,
    category_stats,
    check_columns,
    classify,
    coverage,
    failing_counts,
)
from dashboard.lib.config import get_feature_flags
from dashboard.lib.ordering import bottom, top
from dashboard.lib.overview import org_average_series, org_kpis, top_failing, top_movers
from dashboard.lib.data import owner_handles
from dashboard.lib.linking import pr_template
from dashboard.lib.ownership import (
    OWNER_KEY,
    grade_mix,
    group_summary,
    has_text_data,
    owner_summary,
    ownership_coverage,
    repos_for_owner,
)
from dashboard.lib.proposed_scoring import grade_changes, grade_migration, swap_rows
from dashboard.lib.redaction import DEFAULT_REPLACEMENT, compile_patterns, redact
from dashboard.lib.remediation import RemediationEntry, issue_body, load_remediation_map
from dashboard.lib.schema import LAST_PUSH_COL, REPO_COL, humanize_check
from dashboard.lib.scores_export import dumps
from dashboard.lib.scoring import DEFAULT_LETTER_GRADES, _get_letter_grade
from dashboard.lib.scoring_method import letter_bands, metric_rows, scoring_columns
from dashboard.lib.stewardship import (
    DEFAULT_RULE,
    LIFECYCLE_COL,
    OWNER_COL,
    RELEASE_COL,
    at_risk_repos,
    catalog_url,
    changed_metrics,
    has_column_data,
    production_or_release,
)
from dashboard.lib.tiers import TIER_COL
from dashboard.lib.trends import Snapshot, summarize_weekly_changes
from dashboard.lib.views_maintenance import build_components, build_upgrades
from dashboard.lib.views_repo import build_repo_detail
from dashboard.lib.views_common import (
    BuildContext,
    _iso,
    baseline_of,
    envelope,
    records,
    window,
)

KPI_BASELINE_DAYS = 7
CHANGE_BASELINE_DAYS = 30
OWNERSHIP_PREFIX = "ownership."
SCORE_PREFIX = "score_"
HIGHLIGHT_COUNT = 5
HIGHLIGHT_COLUMNS = [REPO_COL, "score_composite", "score_letter"]
REPO_HISTORY_DAYS = 30
SIGNAL_KINDS = {
    activity._count: "count",
    activity._ratio: "ratio",
    activity._days: "days",
    activity._duration: "duration",
    activity._state: "state",
}
OWNER_COLUMNS = ("ownership.owner_name", "ownership.owner")
GROUP_COLUMNS = {"theme": "ownership.theme", "squad": "ownership.squad"}
KPI_DELTA_FIELDS = {"repos": int, "avg_composite": float, "grade_a": int, "grade_f": int, "stale": int}


def build_meta(ctx: BuildContext) -> dict[str, Any]:
    data_source = ctx.config("data_source")
    scored = ctx.data.scored
    return envelope(
        ctx,
        "dashboard/config",
        config_version=str(scored["score_config_version"].iloc[0]) if "score_config_version" in scored.columns else None,
        branding=ctx.config("org_branding"),
        feature_flags=get_feature_flags(),
        stale_threshold_hours=int(data_source.get("stale_threshold_hours", 48)),
        critically_stale_threshold_hours=int(data_source.get("critically_stale_threshold_hours", 168)),
        snapshot_url=ctx.data.snapshot_url,
        history_url=ctx.data.history_url,
        signals=[
            {"column": s.column, "label": s.label, "group": s.group, "kind": SIGNAL_KINDS[s.formatter]}
            for s in SIGNALS
        ],
    )


def _repo_columns(scored: pd.DataFrame) -> list[str]:
    signal_columns = {signal.column for signal in SIGNALS} | {LAST_PUSH_COL}
    wanted = [REPO_COL, TIER_COL]
    wanted += [col for col in scored.columns if col.startswith(OWNERSHIP_PREFIX)]
    wanted += [col for col in scored.columns if col in signal_columns]
    wanted += [col for col in scored.columns if col.startswith(SCORE_PREFIX)]
    return [col for col in dict.fromkeys(wanted) if col in scored.columns]


def build_repos(ctx: BuildContext) -> dict[str, Any]:
    scored = ctx.data.scored
    checks = [col for col in check_columns(scored.columns) if not col.startswith(OWNERSHIP_PREFIX)]
    categories = {name: cols for name, cols in category_columns(scored.columns).items() if cols}
    rows = records(scored[_repo_columns(scored)])
    for row, (_, source) in zip(rows, scored.iterrows()):
        row["checks"] = {check: classify(source.get(check)) for check in checks}
        row["category_stats"] = {name: list(category_stats(source, cols)) for name, cols in categories.items()}
        row["owner_handles"] = owner_handles(source)
    return envelope(ctx, "scores and checks for the current snapshot", records=rows)


def build_history(ctx: BuildContext) -> dict[str, Any]:
    per_repo: dict[str, list[list[Any]]] = {}
    for snapshot in ctx.data.history:
        stamp = snapshot.timestamp.isoformat()
        for repo, composite, letter in snapshot.df[[REPO_COL, "score_composite", "score_letter"]].itertuples(index=False):
            per_repo.setdefault(str(repo), []).append([stamp, None if pd.isna(composite) else float(composite), letter])
    return envelope(
        ctx,
        "scored snapshot history",
        dates=[snapshot.timestamp.isoformat() for snapshot in ctx.data.history],
        org_average=[[stamp.isoformat(), average] for stamp, average in org_average_series(ctx.data.history)],
        grade_counts=[grade_mix(snapshot.df) for snapshot in ctx.data.history],
        repos=dict(sorted(per_repo.items())),
    )


def kpi_deltas(kpis: dict[str, Any], baseline: dict[str, Any] | None) -> dict[str, int | float] | None:
    if baseline is None:
        return None
    return {field: cast(kpis[field] - baseline[field]) for field, cast in KPI_DELTA_FIELDS.items()}


def highlights(scored: pd.DataFrame) -> dict[str, list[dict[str, Any]]]:
    if scored.empty:
        return {"top": [], "bottom": []}
    ranked = scored[HIGHLIGHT_COLUMNS]
    return {
        "top": records(top(ranked, "score_composite", HIGHLIGHT_COUNT)),
        "bottom": records(bottom(ranked, "score_composite", HIGHLIGHT_COUNT)),
    }


def gainers_and_losers(movers: pd.DataFrame) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    if movers.empty:
        return [], []
    gainers = top(movers[movers["delta"] > 0], "delta", HIGHLIGHT_COUNT)
    losers = bottom(movers[movers["delta"] < 0], "delta", HIGHLIGHT_COUNT)
    return records(gainers), records(losers)


def build_overview(ctx: BuildContext) -> dict[str, Any]:
    scored, history = ctx.data.scored, ctx.data.history
    stale_hours = int(ctx.config("data_source").get("stale_threshold_hours", 48))
    now = ctx.generated_at
    kpi_baseline = baseline_of(history, KPI_BASELINE_DAYS)
    movers_baseline = baseline_of(history, CHANGE_BASELINE_DAYS)
    unmeasured = unmeasured_columns(scored)
    unavailable = sorted(
        {name for metrics in scored.get("score_unavailable_metrics", []) if isinstance(metrics, list) for name in metrics}
    )
    kpis = org_kpis(scored, stale_hours, now)
    baseline_kpis = org_kpis(kpi_baseline.df, stale_hours, now) if kpi_baseline else None
    letter_grades = ctx.config("scoring").get("letter_grades", DEFAULT_LETTER_GRADES)
    movers = top_movers(scored, movers_baseline.df if movers_baseline else None)
    gainers, losers = gainers_and_losers(movers)
    return envelope(
        ctx,
        "overview",
        kpis=kpis,
        kpi_baseline=baseline_kpis,
        kpi_baseline_date=_iso(kpi_baseline.timestamp if kpi_baseline else None),
        avg_letter=_get_letter_grade(kpis["avg_composite"], letter_grades),
        kpi_deltas=kpi_deltas(kpis, baseline_kpis),
        grade_mix=grade_mix(scored),
        unavailable_metrics=unavailable,
        activity_totals=org_total_values(scored, skip=unmeasured),
        unmeasured_columns=sorted(unmeasured),
        category_pass_rates=records(category_pass_rates(scored)),
        top_failing=records(top_failing(scored)),
        highlights=highlights(scored),
        movers=records(movers),
        gainers=gainers,
        losers=losers,
        movers_from=_iso(movers_baseline.timestamp if movers_baseline else None),
        movers_to=_iso(history[-1].timestamp if movers_baseline else None),
    )


def build_what_changed(ctx: BuildContext) -> dict[str, Any]:
    history = window(ctx.data.history, CHANGE_BASELINE_DAYS)
    if len(history) < 2:
        return envelope(ctx, "two most recent snapshots", snapshots=len(history), new_failures=[], new_passes=[])
    latest, previous = history[-1], history[-2]
    changes = summarize_weekly_changes(latest.df, previous.df)
    bulletin = generate_weekly_bulletin(
        changes["new_failures"],
        changes["new_passes"],
        dashboard_url=str(ctx.config("data_source").get("site_url", "")).rstrip("/"),
        commit_sha=ctx.commit_sha,
    )
    return envelope(
        ctx,
        "two most recent snapshots",
        snapshots=len(history),
        latest=latest.timestamp.isoformat(),
        previous=previous.timestamp.isoformat(),
        new_failures=records(changes["new_failures"]),
        new_passes=records(changes["new_passes"]),
        bulletin=bulletin,
    )


def build_attention(ctx: BuildContext) -> dict[str, Any]:
    rules = ctx.config("attention_rules").get("rules", {})
    flagged = needing_attention(ctx.data.scored, rules, ctx.config("tiers"), now=ctx.generated_at)
    return envelope(ctx, "attention_rules.yaml", records=records(flagged))


def _stewardship_rule(ctx: BuildContext) -> dict[str, Any]:
    return ctx.config("attention_rules").get("rules", {}).get("stewardship_risk", {})


def _at_risk(ctx: BuildContext) -> tuple[pd.DataFrame, Snapshot | None, frozenset[str]]:
    baseline = baseline_of(ctx.data.history, CHANGE_BASELINE_DAYS)
    since = baseline.timestamp if baseline else None
    skip = changed_metrics(ctx.config("scoring").get("metrics", {}), since)
    risky = at_risk_repos(
        ctx.data.scored,
        baseline.df if baseline else None,
        now=ctx.generated_at,
        rule=_stewardship_rule(ctx),
        skip_metrics=skip,
    )
    return risky, baseline, skip


def build_at_risk(ctx: BuildContext) -> dict[str, Any]:
    scored = ctx.data.scored
    presence = {
        "has_owner_data": bool(has_column_data(scored, OWNER_COL)),
        "has_lifecycle_data": bool(has_column_data(scored, LIFECYCLE_COL) or has_column_data(scored, RELEASE_COL)),
    }
    if not _stewardship_rule(ctx).get("enabled", True):
        return envelope(ctx, "stewardship_risk rule", enabled=False, **presence, records=[])
    risky, baseline, skip = _at_risk(ctx)
    if not risky.empty:
        risky = risky.assign(production_or_release=production_or_release(risky))
    return envelope(
        ctx,
        "stewardship_risk rule",
        enabled=True,
        **presence,
        baseline_date=_iso(baseline.timestamp if baseline else None),
        skipped_metrics=sorted(skip),
        records=records(risky),
    )


def build_owners(ctx: BuildContext) -> dict[str, Any]:
    scored = ctx.data.scored
    rule = {**DEFAULT_RULE, **_stewardship_rule(ctx)}
    risky, _, _ = _at_risk(ctx)
    at_risk = set(risky.get(REPO_COL, []))
    summary = owner_summary(scored, unmaintained_group=rule["unmaintained_group"], at_risk_repos=at_risk)
    keys = sorted(summary[OWNER_KEY]) if not summary.empty else []
    owned = {key: repos_for_owner(scored, key) for key in keys}
    template = rule["catalog_url_template"]
    return envelope(
        ctx,
        "catalog-info.yaml owners",
        coverage=ownership_coverage(scored),
        has_owner_data=any(has_text_data(scored, column) for column in OWNER_COLUMNS),
        groups={
            name: records(group_summary(scored, column)) if has_text_data(scored, column) else None
            for name, column in GROUP_COLUMNS.items()
        },
        records=records(summary),
        grade_mix={key: grade_mix(frame) for key, frame in owned.items()},
        repos={
            key: records(frame.assign(catalog_link=frame[REPO_COL].map(lambda repo: catalog_url(repo, template))))
            for key, frame in owned.items()
        },
    )


def _category(check: str) -> str | None:
    return next((name for name, predicate in CATEGORY_GROUPS.items() if predicate(check)), None)


def _remediation(entry: RemediationEntry | None, dashboard_url: str) -> dict[str, Any] | None:
    if entry is None:
        return None
    return {**asdict(entry), "issue_body": issue_body(entry, dashboard_url)}


def _check_record(
    check: str,
    series: pd.Series,
    *,
    descriptions: dict,
    score_map: dict,
    remediation: dict[str, RemediationEntry],
    pr_config: dict,
    dashboard_url: str,
) -> dict[str, Any]:
    populated_pct, pass_pct = coverage(series)
    return {
        "check": check,
        "title": humanize_check(check, descriptions),
        "category": _category(check),
        "description": descriptions.get(check),
        "populated_pct": populated_pct,
        "pass_pct": pass_pct,
        "scored_by": score_map.get(check),
        "has_remediation": check in remediation,
        "remediation": _remediation(remediation.get(check), dashboard_url),
        "pr_template": pr_template(check, pr_config) if check in pr_config.get("whitelist", []) else None,
    }


def build_checks(ctx: BuildContext) -> dict[str, Any]:
    snapshot = ctx.data.snapshot
    columns = sorted(check_columns(snapshot.columns))
    descriptions = ctx.config("check_descriptions").get("checks", {})
    score_map = scoring_columns(ctx.config("scoring"))
    remediation = load_remediation_map(ctx.org)
    pr_config = ctx.config("pr_templates")
    dashboard_url = str(ctx.config("data_source").get("site_url", "")).rstrip("/")
    review = review_window(ctx.data.history)
    return envelope(
        ctx,
        "check columns in the current snapshot",
        records=[
            _check_record(
                check,
                snapshot[check],
                descriptions=descriptions,
                score_map=score_map,
                remediation=remediation,
                pr_config=pr_config,
                dashboard_url=dashboard_url,
            )
            for check in columns
        ],
        review_window={"snapshots": review.snapshots, "first": _iso(review.first), "last": _iso(review.last)},
        groups=[
            {"name": name, "checks": members}
            for name, members in catalog_groups(columns, ctx.config("check_groups").get("groups", []))
        ],
        saturation_share=SATURATION_SHARE,
        sparse_fill=SPARSE_FILL,
        up_for_review=records(up_for_review(ctx.data.history, columns)),
        candidates=ctx.config("check_candidates").get("candidates", []),
    )


def _proposed(ctx: BuildContext) -> dict[str, Any] | None:
    proposed_config = ctx.config("scoring_proposed")
    if not proposed_config.get("metrics"):
        return None
    migration = grade_migration(ctx.data.scored, ctx.data.proposed)
    return {
        "version": proposed_config.get("version"),
        "swaps": swap_rows(proposed_config, ctx.data.proposed),
        "migration": {str(current): {str(k): int(v) for k, v in row.items()} for current, row in migration.iterrows()},
        "changes": records(grade_changes(ctx.data.scored, ctx.data.proposed)),
    }


def build_scoring(ctx: BuildContext) -> dict[str, Any]:
    config = ctx.config("scoring")
    return envelope(
        ctx,
        "scoring.yaml and scoring_proposed.yaml",
        version=config.get("version"),
        metrics=metric_rows(config, ctx.data.scored),
        letter_bands=letter_bands(config),
        proposed=_proposed(ctx),
    )


def build_failing_checks(ctx: BuildContext) -> dict[str, Any]:
    scored = ctx.data.scored
    return envelope(
        ctx,
        "check columns in the current snapshot",
        records=records(failing_counts(scored, check_columns(scored.columns))),
    )


def _pass_rate(row: pd.Series, columns: list[str]) -> float | None:
    passed, failed, _ = category_stats(row, columns)
    total = passed + failed
    return round(passed / total * 100, 2) if total else None


def _snapshot_rates(snapshot: Snapshot) -> dict[str, dict[str, float | None]]:
    categories = {name: cols for name, cols in category_columns(snapshot.df.columns).items() if cols}
    return {
        str(row[REPO_COL]): {name: _pass_rate(row, cols) for name, cols in categories.items()}
        for _, row in snapshot.df.iterrows()
    }


def build_repo_history(ctx: BuildContext) -> dict[str, Any]:
    """Per-repo category pass rates over the last 30 days, aligned to ``dates`` (null where absent)."""
    snapshots = window(ctx.data.history, REPO_HISTORY_DAYS)
    rates = [_snapshot_rates(snapshot) for snapshot in snapshots]
    repos = sorted({repo for snapshot_rates in rates for repo in snapshot_rates})
    categories = list(dict.fromkeys(name for snapshot_rates in rates for row in snapshot_rates.values() for name in row))
    return envelope(
        ctx,
        "scored snapshot history",
        dates=[snapshot.timestamp.isoformat() for snapshot in snapshots],
        repos={
            repo: {name: [snapshot_rates.get(repo, {}).get(name) for snapshot_rates in rates] for name in categories}
            for repo in repos
        },
    )


def _raw_value(value: object) -> str | None:
    text = str(value).strip()
    return None if not text or text.lower() == "nan" else text


def build_repo_checks(ctx: BuildContext) -> dict[str, Any]:
    scored = ctx.data.scored
    columns = [col for cols in category_columns(scored.columns).values() for col in cols]
    return envelope(
        ctx,
        "raw check values for the current snapshot",
        repos={
            str(row[REPO_COL]): {column: _raw_value(row.get(column)) for column in columns}
            for _, row in scored.iterrows()
        },
    )


BUILDERS: dict[str, Callable[[BuildContext], dict[str, Any]]] = {
    "meta.json": build_meta,
    "repos.json": build_repos,
    "history.json": build_history,
    "overview.json": build_overview,
    "what_changed.json": build_what_changed,
    "attention.json": build_attention,
    "at_risk.json": build_at_risk,
    "owners.json": build_owners,
    "checks.json": build_checks,
    "scoring.json": build_scoring,
    "failing_checks.json": build_failing_checks,
    "repo_history.json": build_repo_history,
    "repo_checks.json": build_repo_checks,
    "components.json": build_components,
    "upgrades.json": build_upgrades,
    "repo_detail.json": build_repo_detail,
}


def write_views(ctx: BuildContext, out_dir: Path) -> list[Path]:
    redact_config = ctx.config("redact")
    patterns = compile_patterns(redact_config)
    replacement = redact_config.get("replacement", DEFAULT_REPLACEMENT)
    out_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for filename, build in BUILDERS.items():
        path = out_dir / filename
        path.write_text(dumps(redact(build(ctx), patterns, replacement)), encoding="utf-8")
        written.append(path)
    return written
