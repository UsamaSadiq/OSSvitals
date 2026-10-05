"""Drive the served site: settle each page, watch for errors, capture or scan it."""
from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

from playwright.sync_api import Browser, Page, sync_playwright

from scripts.webaudit.pages import WebPage
from scripts.webaudit.site import FROZEN_NOW

NAVIGATION_TIMEOUT_MS = 60_000
SETTLE_MS = 400
CSP_WATCH = """
window.__cspViolations = [];
document.addEventListener('securitypolicyviolation', (event) => {
  window.__cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
});
"""
TWO_FRAMES = "() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))"
CHART_SIZES = "() => [...document.querySelectorAll('svg')].map((svg) => `${svg.getAttribute('width')}x${svg.getAttribute('height')}`).join(',')"
STABLE_POLLS = 3
POLL_MS = 250
CHARTS_DRAWN = "() => [...document.querySelectorAll('.plot-figure')].every((el) => el.querySelector('svg'))"
NOT_LOADING = "() => document.querySelectorAll('.loading').length === 0"


@dataclass
class PageProblems:
    errors: list[str] = field(default_factory=list)


@contextmanager
def browser() -> Iterator[Browser]:
    with sync_playwright() as playwright:
        instance = playwright.chromium.launch(args=["--font-render-hinting=none", "--disable-skia-runtime-opts"])
        try:
            yield instance
        finally:
            instance.close()


def _watch(page: Page, problems: PageProblems) -> None:
    page.on("console", lambda message: problems.errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: problems.errors.append(str(error)))
    page.add_init_script(CSP_WATCH)


def _wait_for_stable_charts(page: Page, max_polls: int = 40) -> None:
    """Charts re-render when their container resizes; capture only once their sizes stop changing."""
    previous, stable = None, 0
    for _ in range(max_polls):
        sizes = page.evaluate(CHART_SIZES)
        stable = stable + 1 if sizes == previous else 0
        if stable >= STABLE_POLLS:
            return
        previous = sizes
        page.wait_for_timeout(POLL_MS)


def open_page(browser_: Browser, spec: WebPage, base_url: str, viewport: tuple[int, int]) -> tuple[Page, PageProblems]:
    width, height = viewport
    context = browser_.new_context(
        viewport={"width": width, "height": height},
        color_scheme=spec.color_scheme,
        reduced_motion="reduce",
        device_scale_factor=1,
    )
    page = context.new_page()
    page.clock.set_fixed_time(FROZEN_NOW)
    problems = PageProblems()
    _watch(page, problems)
    page.goto(spec.url(base_url), wait_until="networkidle", timeout=NAVIGATION_TIMEOUT_MS)
    # Hover styles (table rows, cards) must not depend on where the pointer happens to rest.
    page.mouse.move(0, 0)
    page.wait_for_function(NOT_LOADING, timeout=NAVIGATION_TIMEOUT_MS)
    page.evaluate("() => document.fonts.ready")
    page.wait_for_function(CHARTS_DRAWN, timeout=NAVIGATION_TIMEOUT_MS)
    page.wait_for_load_state("networkidle")
    page.evaluate(TWO_FRAMES)
    _wait_for_stable_charts(page)
    page.wait_for_timeout(SETTLE_MS)
    problems.errors.extend(f"CSP: {item}" for item in page.evaluate("() => window.__cspViolations"))
    return page, problems


def capture(page: Page, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(out_path), full_page=True, animations="disabled", caret="hide")


def inject_axe(page: Page, source: str) -> None:
    """Load axe without a <script> tag, which the site's CSP (correctly) refuses."""
    if not page.evaluate("() => typeof window.axe !== 'undefined'"):
        page.evaluate(source)
