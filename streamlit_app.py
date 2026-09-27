from __future__ import annotations

import streamlit as st

from dashboard.lib.config import get_feature_flags

st.set_page_config(
    page_title="Open edX Repo Health",
    page_icon=":material/health_and_safety:",
    layout="wide",
)

# Pages live in views/, not pages/. Streamlit auto-discovers pages/ and serves a
# direct link to any file there without running this script, which rendered the
# raw filename list as the sidebar (backlog A0). Outside pages/, every URL is
# routed through st.navigation() below. Only the plain-text /healthz endpoint
# stays in pages/, since it must answer without the navigation.
#
# Styling and query-param hydration still live in each page's page_init(), and
# optional pages still enforce their own flag via require_feature(); a page left
# out of the navigation (flag off) no longer resolves at all.
flags = get_feature_flags()

health_pages = [
    st.Page("views/01_overview.py", title="Overview", icon=":material/dashboard:", default=True),
    st.Page("views/02_repo_detail.py", title="Repo Detail", icon=":material/search:"),
    st.Page("views/03_failing_checks.py", title="Failing Checks", icon=":material/error:"),
    st.Page("views/05_what_changed.py", title="What Changed", icon=":material/trending_up:"),
]

# Everything that asks someone to act: triage, thin ownership, who owns what,
# and upgrade work (bot and human PRs).
maintenance_pages = [
    st.Page("views/04_needing_attention.py", title="Needing Attention", icon=":material/priority_high:"),
]
# Backlog C4 asked for this section to be hidden when the snapshot carries no
# ownership fields, on the grounds that an empty top-level section reads as a
# broken product. Implemented and reverted: a page omitted from st.navigation()
# stops resolving as a URL, so /ownership_views answered with a "Page not found"
# modal and fell back to Overview. That breaks every previously shared link to
# it, which is a worse outcome for a link recipient than an honest empty page —
# and the cosmetic concern is addressable in the page's own empty state, which
# is what WP-6 did instead.

if flags.get("enable_maintainer_views", True):
    maintenance_pages += [
        st.Page("views/13_at_risk.py", title="At Risk", icon=":material/warning:"),
        st.Page("views/09_ownership_views.py", title="Owners", icon=":material/groups:"),
    ]
maintenance_pages.append(st.Page("views/12_maintenance.py", title="Upgrades", icon=":material/upgrade:"))

tools_pages = []
if flags.get("enable_sql_page", False):
    tools_pages.append(st.Page("views/07_sql.py", title="SQL", icon=":material/database:"))
if flags.get("enable_badge_links", False):
    tools_pages.append(st.Page("views/08_badges.py", title="Badges", icon=":material/military_tech:"))
if flags.get("enable_year_in_review_cards", False) or flags.get("enable_embeddable_score_cards", False):
    tools_pages.append(st.Page("views/10_cards.py", title="Cards", icon=":material/style:"))

reference_pages = [
    st.Page("views/06_glossary.py", title="Checks Catalog", icon=":material/menu_book:"),
    st.Page("views/11_scoring.py", title="How Scoring Works", icon=":material/calculate:"),
]

sections: dict[str, list] = {"Health": health_pages, "Maintenance": maintenance_pages}
if tools_pages:
    sections["Tools"] = tools_pages
sections["Reference"] = reference_pages

st.navigation(sections).run()
