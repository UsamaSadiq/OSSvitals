"""axe-core accessibility gate for the web app.

Run by ``scripts/web_audit.py --mode a11y``. Every route is scanned at every
viewport with the axe-core build vendored in ``vendor/axe.min.js`` (see that
directory's README for why it is committed rather than fetched). Every finding
blocks: there is no allowlist.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from playwright.sync_api import Page

# The vendored scanner. Read from disk at scan time; nothing here touches the
# network. Pinned to the version recorded in vendor/README.md.
_AXE_PATH = Path(__file__).parent / "vendor" / "axe.min.js"

# Highest impact first, for report ordering and for sorting within a section.
_IMPACT_ORDER: dict[str, int] = {
    "critical": 0,
    "serious": 1,
    "moderate": 2,
    "minor": 3,
    "unknown": 4,
}

# Longest outerHTML snippet kept per sample. axe already elides deep subtrees;
# this keeps a single long <div class="st-emotion-cache-...">  from eating the
# terminal.
_SAMPLE_CHARS = 200
_MAX_SAMPLES = 3

@dataclass(frozen=True)
class Violation:
    """One axe rule failing on one page at one viewport.

    Aggregated per rule rather than per node: axe reports ``region`` as 44
    separate nodes on Overview, and 44 near-identical report lines hide the
    other findings. ``count`` and ``samples`` keep the detail that matters.

    Attributes:
        rule: axe rule id, e.g. ``color-contrast``. The allowlist key.
        impact: ``minor`` | ``moderate`` | ``serious`` | ``critical``, or
            ``unknown`` when axe reports no impact for the rule.
        count: Number of offending nodes.
        help: axe's human-readable help string for the rule.
        samples: Up to three truncated outerHTML snippets, to locate the nodes.
        page: Route name.
        viewport: Viewport key from ``pages.VIEWPORTS``, e.g. ``desktop``.
    """

    rule: str
    impact: str
    count: int
    help: str
    samples: list[str]
    page: str
    viewport: str


def axe_source() -> str:
    """Read the vendored axe-core bundle.

    Raises:
        FileNotFoundError: With a pointer to the vendor README, since a missing
            bundle means an incomplete checkout (or someone gitignored it) and
            the fix is to restore the file, not to fetch one.
    """
    if not _AXE_PATH.exists():
        raise FileNotFoundError(
            f"Vendored axe-core not found at {_AXE_PATH}. It is committed to this "
            f"repo on purpose — see {_AXE_PATH.parent / 'README.md'}. Restore it "
            "from git rather than downloading a different version, or "
            "the scan no longer matches the reviewed rule set."
        )
    return _AXE_PATH.read_text(encoding="utf-8")


def run_axe(page: Page) -> list[dict]:
    """Inject vendored axe-core and return its raw violations list.

    Scans the whole document with no exclusions and no rule allowlist.

    Args:
        page: A Playwright page with the target already loaded and settled.

    Returns:
        axe's ``violations`` array as parsed JSON: one entry per failing rule,
        each with ``id``, ``impact``, ``help``, and a ``nodes`` list.
    """
    # Re-injected after every navigation, since add_script_tag does not survive
    # a page load. Guarded so repeated calls on one loaded page are cheap.
    if not page.evaluate("() => typeof window.axe !== 'undefined'"):
        page.add_script_tag(content=axe_source())

    # resultTypes: ['violations'] tells axe to skip collecting node detail for
    # passes/incomplete/inapplicable, which is most of the runtime on a page
    # with a few thousand nodes. `document` as the context means whole-document.
    raw = page.evaluate(
        """
        async () => {
            const results = await window.axe.run(document, {
                resultTypes: ['violations'],
            });
            return JSON.stringify(results.violations);
        }
        """
    )
    return json.loads(raw)


def to_violations(raw: list[dict], *, page_name: str, viewport: str) -> list[Violation]:
    """Collapse axe's raw per-rule output into ``Violation`` records."""
    out: list[Violation] = []
    for entry in raw:
        nodes = entry.get("nodes") or []
        samples = [
            _truncate(node.get("html", ""))
            for node in nodes[:_MAX_SAMPLES]
            if node.get("html")
        ]
        out.append(
            Violation(
                rule=entry.get("id", "<unknown-rule>"),
                # axe leaves impact null for a handful of rules; normalise so
                # sorting and report formatting never see None.
                impact=entry.get("impact") or "unknown",
                count=len(nodes),
                help=entry.get("help", ""),
                samples=samples,
                page=page_name,
                viewport=viewport,
            )
        )
    return out


def _sort_key(violation: Violation) -> tuple[int, str, str, str]:
    return (_IMPACT_ORDER.get(violation.impact, len(_IMPACT_ORDER)), violation.rule, violation.page, violation.viewport)


def _truncate(html: str) -> str:
    """Flatten and shorten an outerHTML snippet for single-line report output."""
    flat = " ".join(html.split())
    if len(flat) <= _SAMPLE_CHARS:
        return flat
    return flat[: _SAMPLE_CHARS - 1] + "…"


def _format_group(violations: list[Violation]) -> list[str]:
    """Render violations grouped by rule, with per-page node counts."""
    lines: list[str] = []
    by_rule: dict[str, list[Violation]] = {}
    for violation in violations:
        by_rule.setdefault(violation.rule, []).append(violation)

    # Rule order follows the already-sorted input, so severity-first.
    for rule in dict.fromkeys(v.rule for v in violations):
        group = by_rule[rule]
        total = sum(v.count for v in group)
        lines.append(f"  [{group[0].impact}] {rule} — {total} node(s) across {len(group)} page/viewport pair(s)")
        if group[0].help:
            lines.append(f"      {group[0].help}")
        for violation in group:
            lines.append(
                f"      {violation.page} @ {violation.viewport}: {violation.count} node(s)"
            )
        # Samples from the worst offender only; three snippets per rule is
        # enough to find the CSS, and more turns the report into a DOM dump.
        worst = max(group, key=lambda v: v.count)
        for sample in worst.samples:
            lines.append(f"        · {sample}")
        lines.append("")
    return lines


def format_report(violations: list[Violation]) -> str:
    """Human-readable stdout report; every finding blocks."""
    lines: list[str] = ["", "=" * 78, "ACCESSIBILITY AUDIT (axe-core 4.10.2)", "=" * 78, ""]
    nodes = sum(v.count for v in violations)
    lines.append(f"BLOCKING — {len(violations)} finding(s), {nodes} node(s).")
    lines.append("-" * 78)
    if violations:
        lines.extend(_format_group(sorted(violations, key=_sort_key)))
    else:
        lines.append("  None.")
        lines.append("")
    lines.append("=" * 78)
    return "\n".join(lines)
