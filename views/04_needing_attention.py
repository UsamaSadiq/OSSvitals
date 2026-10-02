from __future__ import annotations

import streamlit as st

from dashboard.data import load_config, load_scored_snapshot
from dashboard.lib.attention import needing_attention
from dashboard.lib.clock import now_utc
from dashboard.lib.share import share_link
from dashboard.ui import empty_state, page_init, repo_table, share_link_block


def render() -> None:
    page_init()
    st.title("Repos Needing Attention")

    df = load_scored_snapshot()
    if df.empty:
        empty_state(
            "error",
            "No snapshot available.",
            "The upstream CSV and the local cache are both empty.",
        )
        return

    rules = load_config("attention_rules").get("rules", {})
    tiers_cfg = load_config("tiers")
    selected_tier = st.selectbox("Tier filter", ["all", "critical", "important", "standard"])

    result = needing_attention(df, rules, tiers_cfg, now=now_utc(), tier_filter=selected_tier)

    if result.empty:
        empty_state(
            "good",
            "No repositories currently match the attention rules.",
            "Nothing is flagged by the rules in `attention_rules.yaml` for this tier.",
        )
        return

    repo_table(
        result,
        columns=["repo_name", "repo_tier", "score_composite", "score_letter", "reasons"],
        link_to_detail=True,
    )
    share_link_block(
        share_link({"tab": "needing-attention", "tier": selected_tier}),
        label="Copy link to this view",
    )

    st.download_button(
        "Download Attention List",
        result.to_csv(index=False).encode("utf-8"),
        file_name="needing-attention.csv",
        mime="text/csv",
    )


render()
