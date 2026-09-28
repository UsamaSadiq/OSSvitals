import pandas as pd

from dashboard.lib import catalog

LEGEND = {
    "no_catalog_info": {"label": "No catalog-info.yaml", "severity": "problem"},
    "owner_unprefixed": {"label": "Owner has no prefix", "severity": "problem"},
    "description_missing": {"label": "No description", "severity": "note"},
}
PAYLOAD = {
    "metadata": {"findings": LEGEND},
    "records": [
        {"repo_name": "openedx/a", "has_file": False, "findings": ["no_catalog_info"]},
        {
            "repo_name": "openedx/b", "has_file": True, "has_entity": True, "entity_name": "b", "type": "library",
            "lifecycle": "production", "owner": "core", "release": "master",
            "findings": ["description_missing", "owner_unprefixed"],
            "relations": [
                {"relation": "depends_on", "target": "c", "status": "known"},
                {"relation": "subcomponent_of", "target": "lms", "status": "not_in_catalog"},
            ],
        },
        {"repo_name": "openedx/c", "has_file": True, "has_entity": True, "entity_name": "c", "findings": [],
         "relations": []},
    ],
}


def test_record_for_finds_the_repo_or_none():
    assert catalog.record_for(PAYLOAD, "openedx/c")["entity_name"] == "c"
    assert catalog.record_for(PAYLOAD, "openedx/missing") is None
    assert catalog.record_for(None, "openedx/c") is None


def test_finding_labels_put_problems_first():
    entry = catalog.record_for(PAYLOAD, "openedx/b")

    assert catalog.finding_labels(entry, LEGEND) == [("problem", "Owner has no prefix"), ("note", "No description")]


def test_finding_rows_order_problems_then_count():
    rows = catalog.finding_rows(PAYLOAD)

    assert [(row["code"], row["repos"]) for row in rows] == [
        ("no_catalog_info", ["openedx/a"]),
        ("owner_unprefixed", ["openedx/b"]),
        ("description_missing", ["openedx/b"]),
    ]


def test_components_frame_joins_grades_and_counts_findings():
    scored = pd.DataFrame({"repo_name": ["openedx/b", "openedx/c"], "score_letter": ["B", "A"],
                           "score_composite": [70.0, 90.0]})

    frame = catalog.components_frame(PAYLOAD, scored).set_index("repo_name")

    assert frame.loc["openedx/b", "score_letter"] == "B"
    assert pd.isna(frame.loc["openedx/a", "score_letter"])
    assert frame["finding_count"].to_dict() == {"openedx/a": 1, "openedx/b": 2, "openedx/c": 0}
    assert frame["has_file"].to_dict() == {"openedx/a": False, "openedx/b": True, "openedx/c": True}


def test_components_frame_without_grades():
    frame = catalog.components_frame(PAYLOAD, pd.DataFrame())

    assert "score_letter" not in frame.columns


def test_relation_rows_use_readable_labels():
    assert catalog.relation_rows(PAYLOAD) == [
        {"repo_name": "openedx/b", "relation": "Depends on", "target": "c", "status": "In catalog"},
        {"repo_name": "openedx/b", "relation": "Part of", "target": "lms", "status": "Not in catalog"},
    ]
