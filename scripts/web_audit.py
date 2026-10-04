#!/usr/bin/env python3
"""Visual and accessibility gates for the React frontend in web/.

Serves a built ``web/dist`` the way the Cloudflare Worker does (SPA fallback plus
``_headers``, so CSP violations surface), with views built from the pinned
fixture at the pinned instant and the browser clock frozen to the same instant.

    python scripts/web_audit.py --mode screenshots
    python scripts/web_audit.py --mode baseline     # rewrite tests/baseline-web/
    python scripts/web_audit.py --mode diff
    python scripts/web_audit.py --mode a11y

Every mode also fails on console errors, page errors and CSP violations.
Baselines are Linux-rendered: use scripts/ux_audit_container.sh with
AUDIT_SCRIPT=scripts/web_audit.py, as CI does.
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from scripts.uxaudit import a11y, imagediff  # noqa: E402
from scripts.webaudit.browser import browser, capture, inject_axe, open_page  # noqa: E402
from scripts.webaudit.pages import VIEWPORTS, WebPage, resolve_pages  # noqa: E402
from scripts.webaudit.site import serving  # noqa: E402

BASELINE_DIR = REPO_ROOT / "tests" / "baseline-web"
CURRENT_DIR = REPO_ROOT / ".ux-audit" / "web-current"
DIFF_DIR = REPO_ROOT / ".ux-audit" / "web-diff"
DEFAULT_DIST = REPO_ROOT / "web" / "dist"
TOLERANCE = 0.0025


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--mode", required=True, choices=("screenshots", "baseline", "diff", "a11y"))
    parser.add_argument("--dist", type=Path, default=DEFAULT_DIST, help="Built site to serve. Default: web/dist.")
    parser.add_argument("--pages", default="", help="Comma-separated page names. Default: all.")
    parser.add_argument("--viewport", default="all", choices=(*VIEWPORTS, "all"))
    parser.add_argument("--tolerance", type=float, default=TOLERANCE)
    return parser.parse_args(argv)


def _viewports(choice: str) -> dict[str, tuple[int, int]]:
    return dict(VIEWPORTS) if choice == "all" else {choice: VIEWPORTS[choice]}


def _walk(base_url: str, pages: list[WebPage], viewports: dict[str, tuple[int, int]], visit) -> list[str]:
    """Open every page at every viewport, call ``visit``, and collect runtime errors."""
    errors: list[str] = []
    with browser() as instance:
        for viewport, size in viewports.items():
            for spec in pages:
                page, problems = open_page(instance, spec, base_url, size)
                try:
                    visit(page, spec, viewport)
                finally:
                    page.context.close()
                errors.extend(f"{viewport}/{spec.name}: {error}" for error in problems.errors)
    return errors


def _report_errors(errors: list[str]) -> int:
    if not errors:
        print("Runtime: no console errors, page errors or CSP violations.")
        return 0
    print(f"Runtime: {len(errors)} problem(s)")
    for error in errors:
        print(f"  {error}")
    return 1


def _capture_into(out_dir: Path, base_url: str, pages, viewports) -> list[str]:
    shutil.rmtree(out_dir, ignore_errors=True)
    return _walk(
        base_url,
        pages,
        viewports,
        lambda page, spec, viewport: capture(page, out_dir / viewport / f"{spec.name}.png"),
    )


def _run_a11y(base_url: str, pages, viewports) -> int:
    found: list[a11y.Violation] = []

    source = a11y.axe_source()

    def scan(page, spec, viewport):
        inject_axe(page, source)
        found.extend(a11y.to_violations(a11y.run_axe(page), page_name=spec.name, viewport=viewport))

    errors = _walk(base_url, pages, viewports, scan)
    print(a11y.format_report(found, [], allowlist=False))
    return max(1 if found else 0, _report_errors(errors))


def _run_diff(base_url: str, pages, viewports, tolerance: float) -> int:
    errors = _capture_into(CURRENT_DIR, base_url, pages, viewports)
    results = imagediff.diff_tree(BASELINE_DIR, CURRENT_DIR, DIFF_DIR, tolerance=tolerance)
    print(imagediff.format_report(results))
    failed = any(result.passed is False for result in results)
    return max(1 if failed else 0, _report_errors(errors))


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    pages = resolve_pages([name.strip() for name in args.pages.split(",") if name.strip()])
    viewports = _viewports(args.viewport)
    with serving(args.dist) as base_url:
        print(f"Serving {args.dist} at {base_url}: {len(pages)} page(s) x {len(viewports)} viewport(s)", flush=True)
        if args.mode == "a11y":
            return _run_a11y(base_url, pages, viewports)
        if args.mode == "diff":
            return _run_diff(base_url, pages, viewports, args.tolerance)
        out_dir = BASELINE_DIR if args.mode == "baseline" else CURRENT_DIR
        errors = _capture_into(out_dir, base_url, pages, viewports)
        print(f"Wrote {len(pages) * len(viewports)} screenshot(s) to {out_dir}")
        return _report_errors(errors)


if __name__ == "__main__":
    raise SystemExit(main())
