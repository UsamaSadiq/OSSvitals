from __future__ import annotations

import streamlit as st

from dashboard.lib.badge import markdown_badge
from dashboard.data import load_config, load_snapshot
from dashboard.lib.share import base_url
from dashboard.ui import empty_state, page_init, require_feature


def render() -> None:
    page_init()
    if not require_feature("enable_badge_links", label="Embeddable Badges"):
        return

    st.title("Embeddable Badges")
    st.caption("Phase 2 feature. Generates badge markdown for selected repository.")

    badge_base_url = str(load_config("data_source").get("badge_base_url") or "")
    if not badge_base_url:
        empty_state("info", "Badges are not configured for this organisation.", "Set badge_base_url in data_source.yaml.")
        return

    df = load_snapshot()
    if df.empty:
        empty_state("error", "No snapshot available.", "No badge can be generated.")
        return

    repo = st.selectbox("Repository", sorted(df["repo_name"].astype(str).tolist()))
    badge = markdown_badge(repo, base_url().rstrip("/"), badge_base_url)
    st.write("Badge URL")
    st.code(badge.badge_url, language="text")
    st.write("Markdown")
    st.code(badge.markdown, language="markdown")


render()
