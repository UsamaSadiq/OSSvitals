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


def test_each_org_has_its_own_page_inventory():
    assert [page.name for page in resolve_pages([], "moneta")] == ["overview", "apps", "apps_filtered", "attention", "app_detail", "not_found"]
    assert resolve_pages(["overview"], "moneta")[0].path == "/"


def test_unknown_org_is_rejected_rather_than_audited_with_another_orgs_pages():
    import pytest

    with pytest.raises(ValueError, match="No page inventory"):
        resolve_pages([], "nope")


def test_a11y_report_lists_findings_most_severe_first():
    from scripts.webaudit.a11y import Violation, format_report

    def violation(rule, impact):
        return Violation(rule=rule, impact=impact, count=1, help="h", samples=["<div>"], page="overview", viewport="desktop")

    report = format_report([violation("minor-rule", "minor"), violation("bad-rule", "critical")])
    assert report.index("bad-rule") < report.index("minor-rule")
    assert "2 finding(s)" in report
