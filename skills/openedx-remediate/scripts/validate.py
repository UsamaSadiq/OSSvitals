#!/usr/bin/env python3
"""Validate that a fix for a health check is well-formed before it is committed.

Usage: validate.py <clone_path> <check_name>
Prints JSON {"check", "ok", "evidence": [...], "errors": [...]} and exits 0 only when ok.
Stdlib only; YAML is parsed with PyYAML when importable and with ruby's YAML otherwise.
"""
import configparser
import json
import re
import subprocess
import sys
from pathlib import Path


def load_yaml(path: Path):
    text = path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore

        return yaml.safe_load(text)
    except ImportError:
        script = "require 'yaml'; require 'json'; puts JSON.generate(YAML.safe_load(File.read(ARGV[0])))"
        result = subprocess.run(["ruby", "-e", script, str(path)], capture_output=True, text=True, check=True)
        return json.loads(result.stdout)


def validate_editorconfig(repo: Path) -> tuple[list[str], list[str]]:
    path = repo / ".editorconfig"
    if not path.is_file():
        return [], [".editorconfig is missing"]
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    parser.read_string(path.read_text(encoding="utf-8"))
    sections = parser.sections()
    errors = [] if "*" in sections else ["no [*] section"]
    for key in ("end_of_line", "insert_final_newline", "charset", "indent_style"):
        if "*" in sections and key not in parser["*"]:
            errors.append(f"[*] lacks {key}")
    return [f".editorconfig parses with sections {sections}"], errors


def validate_make_alias(repo: Path, target: str) -> tuple[list[str], list[str]]:
    makefile = (repo / "Makefile").read_text(encoding="utf-8") if (repo / "Makefile").is_file() else ""
    errors = []
    if not re.search(rf"^{re.escape(target)}:", makefile, re.MULTILINE):
        errors.append(f"Makefile has no {target} target")
    phony = " ".join(re.findall(r"^\.PHONY:(.*)$", makefile, re.MULTILINE))
    if target not in phony.split():
        errors.append(f"{target} is not listed in .PHONY")
    dry_run = subprocess.run(["make", "-n", target], cwd=repo, capture_output=True, text=True)
    if dry_run.returncode != 0:
        errors.append(f"make -n {target} failed: {dry_run.stderr.strip()[:300]}")
    return [f"make -n {target} exit {dry_run.returncode}"], errors


def validate_dependabot(repo: Path) -> tuple[list[str], list[str]]:
    path = repo / ".github" / "dependabot.yml"
    if not path.is_file():
        return [], [".github/dependabot.yml is missing"]
    data = load_yaml(path)
    errors = []
    if not isinstance(data, dict) or data.get("version") != 2:
        errors.append("version must be 2")
    updates = data.get("updates") if isinstance(data, dict) else None
    if not isinstance(updates, list) or not updates:
        errors.append("updates must be a non-empty list")
        return [], errors
    for index, update in enumerate(updates):
        for key in ("package-ecosystem", "directory", "schedule"):
            if key not in update:
                errors.append(f"updates[{index}] lacks {key}")
        if "interval" not in (update.get("schedule") or {}):
            errors.append(f"updates[{index}].schedule lacks interval")
    ecosystems = [update.get("package-ecosystem") for update in updates]
    return [f"dependabot.yml version 2 with ecosystems {ecosystems}"], errors


def validate_openedx_yaml(repo: Path) -> tuple[list[str], list[str]]:
    path = repo / "openedx.yaml"
    if not path.is_file():
        return [], ["openedx.yaml is missing"]
    data = load_yaml(path)
    if not isinstance(data, dict):
        return [], ["openedx.yaml is not a mapping"]
    errors = [] if ("oeps" in data or "tags" in data) else ["openedx.yaml needs oeps or tags"]
    return [f"openedx.yaml keys {sorted(data)}"], errors


def validate_tox(repo: Path) -> tuple[list[str], list[str]]:
    path = repo / "tox.ini"
    if not path.is_file():
        return [], ["tox.ini is missing"]
    text = path.read_text(encoding="utf-8")
    errors = ["tox.ini still contains whitelist_externals"] if "whitelist_externals" in text else []
    parser = configparser.ConfigParser(interpolation=None, strict=False)
    try:
        parser.read_string(text)
    except configparser.Error as error:
        errors.append(f"tox.ini does not parse: {error}")
    return [f"tox.ini sections {parser.sections()}"], errors


VALIDATORS = {
    "exists..editorconfig": validate_editorconfig,
    "makefile.test-python": lambda repo: validate_make_alias(repo, "test-python"),
    "makefile.quality-python": lambda repo: validate_make_alias(repo, "quality-python"),
    "dependabot.exists": validate_dependabot,
    "exists.openedx.yaml": validate_openedx_yaml,
    "tox_ini.uses_whitelist_externals": validate_tox,
}


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2
    repo, check = Path(sys.argv[1]), sys.argv[2]
    validator = VALIDATORS.get(check)
    if validator is None:
        print(json.dumps({"check": check, "ok": False, "evidence": [], "errors": ["no validator for this check"]}))
        return 1
    evidence, errors = validator(repo)
    print(json.dumps({"check": check, "ok": not errors, "evidence": evidence, "errors": errors}, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
