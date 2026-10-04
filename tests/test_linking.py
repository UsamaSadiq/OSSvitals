from dashboard.lib.linking import github_issue_url, normalize_params


def test_normalize_params_redirects_old_keys():
    params = normalize_params({"repository": "openedx/edx-platform", "section": "detail"})
    assert params["repo"] == "openedx/edx-platform"
    assert params["tab"] == "detail"


def test_github_issue_url_contains_prefill_fields():
    url = github_issue_url("openedx/edx-platform", "github_actions", "body")
    assert "issues/new" in url
    assert "title=" in url
    assert "body=" in url


def test_moved_url_keeps_path_and_query():
    from dashboard.lib.linking import moved_url

    assert moved_url("https://openedx.ossvitals.org/", "http://127.0.0.1:8501/repo_detail?repo=openedx%2Fx") == (
        "https://openedx.ossvitals.org/repo_detail?repo=openedx%2Fx"
    )
    assert moved_url("https://openedx.ossvitals.org", "https://app.streamlit.app") == "https://openedx.ossvitals.org/"
