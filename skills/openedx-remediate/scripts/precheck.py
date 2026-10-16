#!/usr/bin/env python3
"""Inspect a cloned repository and decide whether a health check can be fixed safely.

Usage: precheck.py <clone_path> <check_name>
Prints JSON: {"check", "facts", "verdict": "fix" | "refuse" | "unsupported", "reason", "plan"}.
The verdict is advice for the agent; the facts are what it must cite in the PR body.
"""
import json
import re
import sys
from pathlib import Path

SUPPORTED = (
    "exists..editorconfig",
    "makefile.test-python",
    "makefile.quality-python",
    "dependabot.exists",
    "exists.openedx.yaml",
    "tox_ini.uses_whitelist_externals",
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace") if path.is_file() else ""


def uses_key(ini_text: str, key: str) -> bool:
    return re.search(rf"^\s*{key}\s*=", ini_text, re.MULTILINE) is not None


def make_targets(makefile: str) -> list[str]:
    return re.findall(r"^([A-Za-z0-9_.-]+):", makefile, re.MULTILINE)


def workflow_names(repo: Path) -> list[str]:
    folder = repo / ".github" / "workflows"
    return sorted(p.name for p in folder.glob("*.y*ml")) if folder.is_dir() else []


def has_upgrade_workflow(repo: Path) -> bool:
    folder = repo / ".github" / "workflows"
    if not folder.is_dir():
        return False
    for workflow in folder.glob("*.y*ml"):
        text = read(workflow)
        if "upgrade" in workflow.name or "make upgrade" in text or "upgrade-python-requirements" in text:
            return True
    return False


def collect_facts(repo: Path) -> dict:
    makefile = read(repo / "Makefile")
    tox_ini = read(repo / "tox.ini")
    return {
        "editorconfig_exists": (repo / ".editorconfig").is_file(),
        "openedx_yaml_exists": (repo / "openedx.yaml").is_file(),
        "catalog_info_exists": (repo / "catalog-info.yaml").is_file(),
        "dependabot_exists": (repo / ".github" / "dependabot.yml").is_file(),
        "renovate_exists": any((repo / name).is_file() for name in ("renovate.json", "renovate.json5", ".renovaterc", ".renovaterc.json")),
        "package_json_exists": (repo / "package.json").is_file(),
        "python_manifest_exists": any((repo / name).exists() for name in ("requirements", "setup.py", "pyproject.toml")),
        "upgrade_workflow_exists": has_upgrade_workflow(repo),
        "workflows": workflow_names(repo),
        "makefile_exists": bool(makefile),
        "make_targets": make_targets(makefile),
        "tox_ini_exists": bool(tox_ini),
        "tox_uses_whitelist_externals": uses_key(tox_ini, "whitelist_externals"),
        "tox_uses_allowlist_externals": uses_key(tox_ini, "allowlist_externals"),
    }


def alias_source(targets: list[str], candidates: tuple[str, ...]) -> str | None:
    return next((name for name in candidates if name in targets), None)


def decide(check: str, facts: dict) -> tuple[str, str, str]:
    if check == "exists..editorconfig":
        if facts["editorconfig_exists"]:
            return "refuse", ".editorconfig already exists; the dashboard snapshot is stale", ""
        return "fix", ".editorconfig is missing", "copy the edx-lint generated template from openedx/.github"

    if check in ("makefile.test-python", "makefile.quality-python"):
        if not facts["makefile_exists"]:
            return "refuse", "no Makefile; adding one is a design decision for maintainers", ""
        wanted = check.split(".")[1]
        if wanted in facts["make_targets"]:
            return "refuse", f"Makefile already defines {wanted}; the dashboard snapshot is stale", ""
        sources = ("test", "tests") if wanted == "test-python" else ("quality", "lint")
        source = alias_source(facts["make_targets"], sources)
        if source is None:
            return "refuse", f"no existing {' or '.join(sources)} target to alias; a real {wanted} target needs maintainer input", ""
        return "fix", f"Makefile has {source} but not {wanted}", f"add {wanted} as an alias of {source} and list it in .PHONY"

    if check == "dependabot.exists":
        if facts["dependabot_exists"]:
            return "refuse", ".github/dependabot.yml already exists; the dashboard snapshot is stale", ""
        if facts["renovate_exists"]:
            return "refuse", "repo uses Renovate for dependency updates; Dependabot would duplicate it", ""
        ecosystems = ["github-actions"]
        if facts["package_json_exists"]:
            ecosystems.append("npm")
        if facts["python_manifest_exists"] and not facts["upgrade_workflow_exists"]:
            ecosystems.append("pip")
        return "fix", "no Dependabot or Renovate configuration", "add .github/dependabot.yml for: " + ", ".join(ecosystems)

    if check == "exists.openedx.yaml":
        if facts["openedx_yaml_exists"]:
            return "refuse", "openedx.yaml already exists; the dashboard snapshot is stale", ""
        if facts["catalog_info_exists"]:
            return "refuse", "repo already migrated to catalog-info.yaml (openedx/public-engineering#410); openedx.yaml would be a regression and the scoring rule is the thing to fix", ""
        return "fix", "no openedx.yaml or catalog-info.yaml", "add a minimal OEP-2 openedx.yaml with oeps and tags"

    if check == "tox_ini.uses_whitelist_externals":
        if not facts["tox_ini_exists"]:
            return "refuse", "no tox.ini; the check does not apply", ""
        if facts["tox_uses_whitelist_externals"]:
            return "fix", "tox.ini still uses the deprecated whitelist_externals key", "rename whitelist_externals to allowlist_externals"
        return "refuse", "tox.ini does not use whitelist_externals; dashboard/lib/checks.py classifies the raw false as a failure (inverted boolean), nothing to change in this repo", ""

    return "unsupported", f"{check} is not in the fix catalog", ""


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    repo, check = Path(sys.argv[1]), sys.argv[2]
    if not repo.is_dir():
        print(json.dumps({"check": check, "verdict": "error", "reason": f"{repo} is not a directory"}))
        return 1
    facts = collect_facts(repo)
    verdict, reason, plan = decide(check, facts)
    print(json.dumps({"check": check, "supported": check in SUPPORTED, "facts": facts, "verdict": verdict, "reason": reason, "plan": plan}, indent=2))
    return 0 if verdict == "fix" else 3


if __name__ == "__main__":
    sys.exit(main())
