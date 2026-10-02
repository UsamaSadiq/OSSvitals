"""Static ossvitals.org pages: deployable config and the legal footer they must carry."""
import json
from pathlib import Path

import pytest

SITES = Path(__file__).resolve().parents[1] / "sites"
SOURCE_URL = "https://github.com/UsamaSadiq/OSSvitals"


@pytest.mark.parametrize("site", ["landing", "placeholder"])
def test_site_is_an_assets_only_worker_on_a_custom_domain(site):
    config = json.loads((SITES / site / "wrangler.json").read_text())

    assert "main" not in config
    assert (SITES / site / config["assets"]["directory"] / "index.html").exists()
    assert config["workers_dev"] is False
    assert all(route["custom_domain"] and route["pattern"].endswith(".ossvitals.org") for route in config["routes"])


@pytest.mark.parametrize("site", ["landing", "placeholder"])
def test_pages_link_source_and_privacy(site):
    html = (SITES / site / "public" / "index.html").read_text()

    assert f'href="{SOURCE_URL}"' in html
    assert f'href="{SOURCE_URL}/blob/main/docs/PRIVACY.md"' in html


def test_landing_carries_the_trademark_notice():
    html = (SITES / "landing" / "public" / "index.html").read_text()

    assert "not affiliated with or endorsed by Axim Collaborative" in html
    assert "Open edX is a registered trademark of Axim Collaborative" in html


def test_placeholder_is_not_indexed():
    site = SITES / "placeholder" / "public"

    assert '<meta name="robots" content="noindex">' in (site / "index.html").read_text()
    assert "X-Robots-Tag: noindex" in (site / "_headers").read_text()
