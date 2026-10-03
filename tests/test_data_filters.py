import pandas as pd

from dashboard.lib import data


def test_load_my_repos_matches_repo_owner(monkeypatch):
    frame = pd.DataFrame(
        {
            "repo_name": ["openedx/edx-platform", "example/other"],
            "ownership.theme": ["", ""],
            "ownership.squad": ["", ""],
        }
    )
    monkeypatch.setattr(data, "load_snapshot", lambda: frame)

    result = data.load_my_repos("openedx")
    assert len(result) == 1
    assert result.iloc[0]["repo_name"] == "openedx/edx-platform"


def test_load_my_repos_matches_maintainers_token(monkeypatch):
    frame = pd.DataFrame(
        {
            "repo_name": ["example/repo"],
            "maintainers": ["[@Usama_Sadiq, someone_else]"],
        }
    )
    monkeypatch.setattr(data, "load_snapshot", lambda: frame)

    result = data.load_my_repos("usama_sadiq")
    assert len(result) == 1


def test_load_my_repos_matches_ownership_owner(monkeypatch):
    frame = pd.DataFrame(
        {
            "repo_name": ["example/repo", "another/repo"],
            "ownership.owner": ["user:alice", "group:axim-admins"],
        }
    )
    monkeypatch.setattr(data, "load_snapshot", lambda: frame)

    result = data.load_my_repos("alice")
    assert len(result) == 1
    assert result.iloc[0]["repo_name"] == "example/repo"


def test_load_my_repos_matches_ownership_owner_name(monkeypatch):
    """The catalog-info-derived owner_name column is matched too."""
    frame = pd.DataFrame(
        {
            "repo_name": ["example/repo", "another/repo"],
            "ownership.owner_name": ["team-x", "team-y"],
        }
    )
    monkeypatch.setattr(data, "load_snapshot", lambda: frame)

    result = data.load_my_repos("team-x")
    assert len(result) == 1
    assert result.iloc[0]["repo_name"] == "example/repo"


def test_owner_handles_match_what_load_my_repos_matches(monkeypatch):
    import pandas as pd

    from dashboard.lib import data

    frame = pd.DataFrame(
        {
            "repo_name": ["openedx/a", "edx/b", "openedx/c"],
            "ownership.owner_name": ["@Alice", "team-x, bob", None],
            "ownership.squad": [None, "Squad One", "squad-two"],
        }
    )
    monkeypatch.setattr(data, "load_snapshot", lambda: frame)
    for handle in ["openedx", "edx", "alice", "bob", "team-x", "squad", "one", "squad-two", "carol"]:
        mine = data.load_my_repos(handle)
        matched = set(mine["repo_name"]) if not mine.empty else set()
        by_handles = {row["repo_name"] for _, row in frame.iterrows() if handle in data.owner_handles(row)}
        assert by_handles == matched, handle
    assert not any("nan" in data.owner_handles(row) for _, row in frame.iterrows())
