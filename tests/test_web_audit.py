from __future__ import annotations

from scripts.webaudit.pages import PAGES, VIEWPORTS, resolve_pages
from scripts.webaudit.site import headers_for, parse_headers

HEADERS = """
/*
  Content-Security-Policy: default-src 'self'
  X-Content-Type-Options: nosniff

https://next.ossvitals.org/*
  X-Robots-Tag: noindex

/assets/*
  Cache-Control: public, max-age=31536000, immutable
"""


def test_parse_headers_keeps_rules_in_file_order():
    rules = parse_headers(HEADERS)
    assert [pattern for pattern, _ in rules] == ["/*", "https://next.ossvitals.org/*", "/assets/*"]


def test_headers_for_applies_path_rules_and_skips_host_rules():
    rules = parse_headers(HEADERS)
    assert headers_for(rules, "/assets/index.js") == [
        ("Content-Security-Policy", "default-src 'self'"),
        ("X-Content-Type-Options", "nosniff"),
        ("Cache-Control", "public, max-age=31536000, immutable"),
    ]
    assert ("X-Robots-Tag", "noindex") not in headers_for(rules, "/")


def test_web_audit_inventory_is_unique_and_resolvable():
    names = [page.name for page in PAGES]
    assert len(names) == len(set(names))
    assert resolve_pages(["overview", "not_found"]) == [PAGES[0], PAGES[-1]]
    assert set(VIEWPORTS) == {"desktop", "mobile"}
