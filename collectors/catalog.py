"""Catalog snapshot: what each repo's ``catalog-info.yaml`` declares, and where it is off.

Backstage (backstage.openedx.org) reads the same files. This snapshot adds what a
catalog cannot show on its own: which repos have no file, which entries a
maintainer left half-filled, and relations that point at nothing. Findings are
codes; ``FINDINGS`` carries their labels and is published with the records so
the dashboard never keeps a second copy of the wording.
"""
from __future__ import annotations

from typing import Any, Callable

import yaml

BACKSTAGE_COMPONENT_URL = "https://backstage.openedx.org/catalog/default/component/{name}"

PROBLEM = "problem"
NOTE = "note"

FINDINGS: dict[str, dict[str, str]] = {
    "no_catalog_info": {"label": "No catalog-info.yaml", "severity": PROBLEM},
    "no_entity": {"label": "catalog-info.yaml is empty or not valid YAML", "severity": PROBLEM},
    "not_a_component": {"label": "Entity kind is not Component", "severity": PROBLEM},
    "owner_missing": {"label": "No owner set", "severity": PROBLEM},
    "owner_unprefixed": {
        "label": "Owner has no group: or user: prefix, so Backstage reads it as a group",
        "severity": PROBLEM,
    },
    "owner_user_not_found": {"label": "Owner user does not exist on GitHub", "severity": PROBLEM},
    "template_placeholders": {"label": "Template placeholders left in the file", "severity": PROBLEM},
    "relation_unknown": {"label": "Depends on or belongs to an entity not in the catalog", "severity": PROBLEM},
    "type_nonstandard": {"label": "Type is not service, website or library", "severity": NOTE},
    "lifecycle_nonstandard": {"label": "Lifecycle is not experimental, production or deprecated", "severity": NOTE},
    "description_missing": {"label": "No description", "severity": NOTE},
}

STANDARD_TYPES = {"service", "website", "library"}
STANDARD_LIFECYCLES = {"experimental", "production", "deprecated"}
RELATION_FIELDS = {"depends_on": "dependsOn", "subcomponent_of": "subcomponentOf", "dependency_of": "dependencyOf"}
RELEASE_ANNOTATION = "openedx.org/release"
INTEREST_ANNOTATION = "openedx.org/arch-interest-groups"
USER_STATUS_UNCHECKED = "unchecked"
USER_STATUS_EXISTS = "exists"
USER_STATUS_NOT_FOUND = "not_found"


def parse(text: str | None) -> dict[str, Any] | None:
    """The first mapping in the file, or None when there is none or the YAML is invalid."""
    if not text:
        return None
    try:
        documents = list(yaml.safe_load_all(text))
    except yaml.YAMLError:
        return None
    return next((document for document in documents if isinstance(document, dict)), None)


def _text(value: Any) -> str:
    return "" if value is None else str(value).strip()


def _list(value: Any) -> list[str]:
    if value is None:
        return []
    items = value if isinstance(value, list) else [value]
    return [_text(item) for item in items if _text(item)]


def _split_owner(owner: str) -> tuple[str | None, str]:
    if not owner:
        return None, ""
    kind, separator, name = owner.partition(":")
    if not separator:
        return "unprefixed", owner
    return kind.lower(), name


def _target_name(reference: str) -> str:
    return reference.split(":", 1)[-1].split("/", 1)[-1]


def _is_placeholder(value: str) -> bool:
    return value.startswith("<") and value.endswith(">")


def record(repo_name: str, text: str | None) -> dict[str, Any]:
    """Everything the file declares for one repo, before org-wide checks."""
    if text is None:
        return {"repo_name": repo_name, "has_file": False}
    entity = parse(text)
    if entity is None:
        return {"repo_name": repo_name, "has_file": True, "has_entity": False}
    metadata = entity.get("metadata") or {}
    spec = entity.get("spec") or {}
    annotations = metadata.get("annotations") or {}
    owner = _text(spec.get("owner"))
    owner_kind, owner_name = _split_owner(owner)
    name = _text(metadata.get("name"))
    return {
        "repo_name": repo_name,
        "has_file": True,
        "has_entity": True,
        "kind": _text(entity.get("kind")),
        "entity_name": name,
        "description": _text(metadata.get("description")),
        "type": _text(spec.get("type")),
        "lifecycle": _text(spec.get("lifecycle")),
        "owner": owner,
        "owner_kind": owner_kind,
        "owner_name": owner_name,
        "release": _text(annotations.get(RELEASE_ANNOTATION)) or None,
        "arch_interest_groups": _list(str(annotations.get(INTEREST_ANNOTATION) or "").split(",")),
        "links": [
            {"url": _text(link.get("url")), "title": _text(link.get("title")) or _text(link.get("url"))}
            for link in metadata.get("links") or []
            if isinstance(link, dict) and _text(link.get("url"))
        ],
        **{field: _list(spec.get(source)) for field, source in RELATION_FIELDS.items()},
        "backstage_url": BACKSTAGE_COMPONENT_URL.format(name=name) if name else None,
    }


RELATION_KNOWN = "known"
RELATION_NOT_IN_CATALOG = "not_in_catalog"
RELATION_PLACEHOLDER = "placeholder"


def relations(entry: dict[str, Any], entity_names: set[str]) -> list[dict[str, str]]:
    """Each declared relation with whether its target is an entity in the org (names lowercased)."""
    def status(target: str) -> str:
        if _is_placeholder(target):
            return RELATION_PLACEHOLDER
        return RELATION_KNOWN if _target_name(target).lower() in entity_names else RELATION_NOT_IN_CATALOG

    return [
        {"relation": field, "target": target, "status": status(target)}
        for field in RELATION_FIELDS
        for target in entry.get(field, [])
    ]


def findings(entry: dict[str, Any]) -> list[str]:
    """Finding codes for one record; relation checks read the statuses from ``relations``."""
    if not entry.get("has_file"):
        return ["no_catalog_info"]
    if not entry.get("has_entity"):
        return ["no_entity"]
    statuses = {relation["status"] for relation in entry.get("relations", [])}
    checks: list[tuple[str, Callable[[], bool]]] = [
        ("not_a_component", lambda: entry["kind"].lower() != "component"),
        ("owner_missing", lambda: not entry["owner"]),
        ("owner_unprefixed", lambda: entry["owner_kind"] == "unprefixed"),
        ("owner_user_not_found", lambda: entry.get("owner_status") == USER_STATUS_NOT_FOUND),
        ("template_placeholders", lambda: RELATION_PLACEHOLDER in statuses),
        ("relation_unknown", lambda: RELATION_NOT_IN_CATALOG in statuses),
        ("type_nonstandard", lambda: entry["type"].lower() not in STANDARD_TYPES),
        ("lifecycle_nonstandard", lambda: entry["lifecycle"].lower() not in STANDARD_LIFECYCLES),
        ("description_missing", lambda: not entry["description"]),
    ]
    return [code for code, applies in checks if applies()]


def user_owner_logins(entries: list[dict[str, Any]]) -> set[str]:
    return {entry["owner_name"] for entry in entries if entry.get("owner_kind") == "user" and entry.get("owner_name")}


def with_owner_status(entry: dict[str, Any], existing_users: set[str] | None) -> dict[str, Any]:
    """Mark user owners as existing or not; groups stay unchecked (needs org membership)."""
    if not entry.get("has_entity"):
        return entry
    if entry.get("owner_kind") != "user" or existing_users is None:
        return {**entry, "owner_status": USER_STATUS_UNCHECKED}
    exists = entry["owner_name"].lower() in {login.lower() for login in existing_users}
    return {**entry, "owner_status": USER_STATUS_EXISTS if exists else USER_STATUS_NOT_FOUND}


def snapshot(texts: dict[str, str | None], existing_users: set[str] | None) -> list[dict[str, Any]]:
    """Records for every repo, with owner status and findings, ordered by repo."""
    entries = [with_owner_status(record(repo, text), existing_users) for repo, text in sorted(texts.items())]
    names = {entry["entity_name"].lower() for entry in entries if entry.get("entity_name")}
    related = [{**entry, "relations": relations(entry, names)} if entry.get("has_entity") else entry for entry in entries]
    return [{**entry, "findings": findings(entry)} for entry in related]


def summary(records: list[dict[str, Any]]) -> dict[str, Any]:
    counts = {code: 0 for code in FINDINGS}
    for entry in records:
        for code in entry.get("findings", []):
            counts[code] += 1
    return {
        "repos": len(records),
        "with_file": sum(bool(entry.get("has_file")) for entry in records),
        "with_problem": sum(
            any(FINDINGS[code]["severity"] == PROBLEM for code in entry.get("findings", [])) for entry in records
        ),
        "findings": counts,
    }
