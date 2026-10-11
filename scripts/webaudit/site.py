"""Serve a built web/dist the way the Cloudflare Worker does: SPA fallback plus _headers.

Pinned fixture data is built into the served copy, so captures are a function of
the code alone (a pinned fixture and a frozen instant).
"""
from __future__ import annotations

import mimetypes
import os
import shutil
import subprocess
import sys
import tempfile
import threading
from collections.abc import Iterator
from contextlib import contextmanager
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "data"
ORG_FIXTURES_DIR = REPO_ROOT / "tests" / "fixtures"
CSV_ORG = "openedx"
FROZEN_NOW = "2026-08-31T12:00:00+00:00"
PINNED_COMMIT_SHA = "0000000000000000000000000000000000000000"
DATA_PREFIXES = ("/data/", "/assets/")

mimetypes.add_type("text/javascript", ".js")


def parse_headers(text: str) -> list[tuple[str, list[tuple[str, str]]]]:
    """Cloudflare ``_headers`` rules as ``(pattern, [(name, value)])`` in file order."""
    rules: list[tuple[str, list[tuple[str, str]]]] = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():
            rules.append((line.strip(), []))
        elif rules and ":" in line:
            name, value = line.strip().split(":", 1)
            rules[-1][1].append((name.strip(), value.strip()))
    return rules


def _matches(pattern: str, path: str) -> bool:
    if pattern.startswith("http"):
        return False
    if pattern.endswith("*"):
        return path.startswith(pattern[:-1])
    return path == pattern


def headers_for(rules: list[tuple[str, list[tuple[str, str]]]], path: str) -> list[tuple[str, str]]:
    return [header for pattern, headers in rules if _matches(pattern, path) for header in headers]


class _SiteHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, rules, **kwargs):
        self._rules = rules
        super().__init__(*args, **kwargs)

    def translate_path(self, path: str) -> str:
        clean = urlsplit(path).path
        candidate = Path(super().translate_path(clean))
        if candidate.is_file() or clean.startswith(DATA_PREFIXES):
            return str(candidate)
        return str(Path(self.directory) / "index.html")

    def end_headers(self) -> None:
        for name, value in headers_for(self._rules, urlsplit(self.path).path):
            self.send_header(name, value)
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        return


def build_fixture_views(out_dir: Path) -> None:
    env = {
        **os.environ,
        "DASHBOARD_DATA_FIXTURE": str(FIXTURE_DIR),
        "DASHBOARD_FROZEN_NOW": FROZEN_NOW,
        "GITHUB_SHA": PINNED_COMMIT_SHA,
        "PYTHONPATH": str(REPO_ROOT),
    }
    subprocess.run(
        [
            sys.executable,
            str(REPO_ROOT / "scripts" / "build_views.py"),
            "--out-dir", str(out_dir),
            "--maintenance-dir", str(FIXTURE_DIR / "maintenance"),
        ],
        check=True,
        env=env,
        stdout=subprocess.DEVNULL,
    )


def copy_static_views(org: str, out_dir: Path) -> None:
    source = ORG_FIXTURES_DIR / org / "views"
    if not source.is_dir():
        raise FileNotFoundError(f"No view fixtures for org {org!r}; expected {source}.")
    shutil.copytree(source, out_dir)


def _prepare(dist: Path, root: Path, org: str) -> None:
    if not (dist / "index.html").is_file():
        raise FileNotFoundError(f"{dist} has no index.html; run `npm run build` in web/ first.")
    shutil.copytree(dist, root, ignore=shutil.ignore_patterns("data"))
    views_dir = root / "data" / org / "views"
    if org == CSV_ORG:
        build_fixture_views(views_dir)
    else:
        copy_static_views(org, views_dir)


@contextmanager
def serving(dist: Path, org: str = CSV_ORG) -> Iterator[str]:
    """Serve ``dist`` plus the org's fixture views on a free loopback port; yields the base URL.

    ``dist`` must be built with ``VITE_DEFAULT_ORG`` set to ``org``, since the audit
    runs on 127.0.0.1 and the app picks its org from the build, not the host.
    """
    with tempfile.TemporaryDirectory(prefix="web-audit-") as tmp:
        root = Path(tmp) / "site"
        _prepare(dist, root, org)
        rules = parse_headers((root / "_headers").read_text(encoding="utf-8")) if (root / "_headers").exists() else []
        handler = partial(_SiteHandler, directory=str(root), rules=rules)
        server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_address[1]}"
        finally:
            server.shutdown()
            server.server_close()
