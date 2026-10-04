"""Which React routes the web audit captures, and at which viewports and themes."""
from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlencode

FIXTURE_REPO = "openedx/auth-backends"


@dataclass(frozen=True)
class WebPage:
    name: str
    path: str
    query: dict[str, str] | None = None
    color_scheme: str = "dark"

    def url(self, base_url: str) -> str:
        suffix = f"?{urlencode(self.query)}" if self.query else ""
        return f"{base_url}{self.path}{suffix}"


PAGES: list[WebPage] = [
    WebPage("overview", "/"),
    WebPage("overview_light", "/", color_scheme="light"),
    WebPage("repo_detail", "/repo_detail", {"repo": FIXTURE_REPO}),
    WebPage("failing_checks", "/failing_checks"),
    WebPage("failing_checks_selected", "/failing_checks", {"category": "dependabot.exists"}),
    WebPage("what_changed", "/what_changed"),
    WebPage("needing_attention", "/needing_attention"),
    WebPage("at_risk", "/at_risk"),
    WebPage("ownership_views", "/ownership_views"),
    WebPage("maintenance", "/maintenance"),
    WebPage("components", "/components"),
    WebPage("glossary", "/glossary"),
    WebPage("scoring", "/scoring"),
    WebPage("not_found", "/no-such-page"),
]

VIEWPORTS: dict[str, tuple[int, int]] = {
    "desktop": (1440, 1000),
    "mobile": (390, 844),
}


def resolve_pages(names: list[str]) -> list[WebPage]:
    if not names:
        return list(PAGES)
    by_name = {page.name: page for page in PAGES}
    unknown = [name for name in names if name not in by_name]
    if unknown:
        raise ValueError(f"Unknown page(s): {', '.join(unknown)}. Valid names: {', '.join(by_name)}")
    return [page for page in PAGES if page.name in set(names)]
