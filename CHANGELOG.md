# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.2/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- The fleet manifest in `meta.json` now matches the pages: each signal's `show` list in `_kinds/fleet/defaults.yaml` names exactly the surfaces that display it today, and each signal also carries the status `thresholds` it owns and its `settings`; `statuses` is the full ladder with thresholds. Groundwork for the Signals settings panel.
- Tenants are registered in one place, `dashboard/config/tenants.json` (org, kind, site): the web app and the MCP server bundle it, and `collect-fleet.yml` and `collect-fleet-weekly.yml` run once per fleet org in it (per-org concurrency, publish retried from a fresh clone). A new fleet tenant needs config only. The MCP `list_tenants` kind for Moneta is now `fleet` (was `drift`), and `mcp/src/{tools,projections}/drift.ts` are renamed to `fleet.ts`.
- Moneta's collector, pages and MCP schemas are now a reusable `fleet` kind: a fleet tenant is config only. `dashboard/config/_kinds/fleet/defaults.yaml` holds every signal's defaults (`collect`, `show` surfaces, settings) and the status ladder; `<org>/fleet.yaml` overrides them (Moneta: branches, `fork_release_tag`, `promotion` on) and replaces `status.yaml`. Each signal is a module in `collectors/fleet/signals/` that owns its record fields (absent when not collected, `null` when collection failed); shared lookups are fetched once per fork and only when needed. `scripts/collect_fleet.py --org <org> [--tier clone]` replaces both Moneta scripts, run by `collect-fleet.yml` and `collect-fleet-weekly.yml`. `meta.json` gains `kind` and a `fleet` manifest (every signal with `collect`/`show`/`tier`/`cadence`, and the statuses with badge colours). The web module moved to `web/src/kinds/fleet/` and reads its org from the tenant. Moneta's published views, badges and `VERSIONS.md` are unchanged.
- Data reaches the site without a rebuild: `sync-data.yml` mirrors the `data` branch to the public `ossvitals-data` R2 bucket after every collector run, the production web app and the MCP Worker read it from `https://data.ossvitals.org`, and `deploy-web.yml` only runs for code changes.
- Maintenance data refreshes per repo between daily runs: the new `ossvitals-events` Worker (`events/`) watches openedx pushes and PR updates and dispatches `collect-maintenance.yml` with the changed repos, which `collect_maintenance.py --merge` folds into the published files. Upgrades and Components captions show when changed repos were last refreshed. Upgrade-job health stays daily.
- Upgrades page: repository names in every table link to the repo on GitHub, and the Redundant PRs tab is hidden when no redundant PRs were found.

### Fixed
- `tox_ini.uses_whitelist_externals` was scored as a plain boolean although the upstream check records True when the deprecated key is still used, so every repo that had already migrated was listed as failing. `check_descriptions.yaml` now declares the column under `inverted` and both loaders flip it once, so a failure means the key is really present.
- Moneta fork releases no longer pick up upstream tags (default `v2x.y.z` pattern), and a multi-line upstream such as Twenty counts one release line.
- The accessibility report crashed instead of listing findings (`_sort_key` was undefined).

### Removed
- The Streamlit dashboard, its UI tests, screenshot baselines and audit harness. The web app is the only front end.
- `streamlit`, `plotly`, `duckdb`, `rapidfuzz` and `pydantic` dependencies.

### Added
- Upgrade risk, a weekly fleet signal: database migrations both we and upstream added since our last sync (with number prefixes used on both sides) and upstream release notes since our base release that flag breaking changes or required upgrade steps, on the app page and Needs attention. Off by default; on for Moneta.
- Carried patches, a weekly fleet signal: each fork's own commits, split into those we carry and those upstream already has (they drop at the next sync), on the app page with links to the commits and as an overview tile. The weekly job now clones each fork once for every weekly signal. Off by default; on for Moneta (zammad: 316 commits of our own, 81 already in upstream).
- Known exploited, a fleet signal: upstream advisories that apply to a fork's code and appear in CISA's catalog of known exploited vulnerabilities, shown on fork cards, the app page (with links to the advisories and how many could not be checked for lack of a CVE id) and Needs attention. The catalog is downloaded once per run and cached on the `data` branch, so a CISA outage uses the last copy for up to 7 days and never fails the run. Off by default; on for Moneta.
- Licence watch, the first new fleet signal: each fork's upstream licence file on the branch we track is compared with the previous run, and a change is shown on fork cards, the app page and Needs attention for 30 days, with a link to the file's history. When GitHub recognises the licence it is also checked against the licence listed in `apps.yaml`. On by default; listed on the Signals page.
- Signals page on fleet dashboards (`/signals`, Settings in the sidebar): every signal with its state, where it shows, its settings, the statuses it can decide and collection failures. Viewers can hide a signal in their own browser; changing it for everyone is a proposed `fleet.yaml` edit. Every fleet page now shows a signal only on the surfaces its manifest lists, through one hook, so the panel and the pages always agree.
- Support Window page (`/support_window`, Maintenance sidebar): the OEP-10 support calendar built daily by `collect_maintenance.py --collector support_windows` from endoflife.date release cycles, the versions the latest Tutor release ships (`refs` in `support_windows.yaml`), and the `CURRENT` dict in repo-tools `barcalendar.py`. New releases appear without hand edits; a product whose declared version differs from what Tutor ships is flagged as drift with a link to edit `barcalendar.py`, and the nav badge counts drift plus past-end-of-life products. Not part of scoring. Org-wide only, so `--merge` runs skip it. `check_freshness.py` flags `support_windows.json` when it is over 2 days old.
- Package upgrade campaigns: `campaigns.yaml` names a package and a minimum version, `collect_maintenance.py --collector campaigns` reads each repo's pins from `requirements/**/*.txt` and `uv.lock` (runtime vs dev/test), joins open PRs, and the Upgrades page gets a campaign tab per entry. Tabs: Certifi 2026.10.19 (public-engineering#574), UV 0.13.4 and Pip 26.2.2. An open PR whose title names a target version below the floor is not counted as the campaign PR.
- Remediation guidance and descriptions for `exists..editorconfig`, `makefile.test-python`, `makefile.quality-python` and `tox_ini.uses_whitelist_externals`, the checks the remediation skill can fix.
- Fix PR tracker: `collect_maintenance.py --collector fix_prs` finds open PRs carrying the `OSSvitals-Check` and `OSSvitals-Repo` marker lines, `repo_detail` carries the newest open PR per failing check, the Repo Detail page shows a "Draft fix PR" or "Fix PR open" badge linking to it, and `get_repo` reports it as `fix_pr`.
- `skills/openedx-remediate/`: a Claude Code skill that turns one failing Open edX health check into one validated draft PR on the user's fork, with a fix catalog (editorconfig, Makefile aliases, Dependabot, openedx.yaml, tox allowlist), clone-side preconditions that refuse stale or wrong fixes, and the Open edX AI-use disclosure in the PR body.
- MCP server (`mcp/`): a read-only Cloudflare Worker at `mcp.ossvitals.org` that exposes the published views to MCP clients, one endpoint per tenant, with health tools (overview, repos, repo, check, attention) and drift tools (apps, app, conflict forecast).
- Moneta: per-app `fork_release_tag` and `release_tag` patterns, `behind_release`/`ahead_release` against the latest upstream release, and `affects_fork_release` on advisories (version ranges against the upstream release our fork is based on).
- Moneta tenant: `config/moneta/` (app inventory, status thresholds, updates), a daily API-only collector (`scripts/collect_moneta.py`, `collect-moneta.yml`) and a weekly conflict forecast (`scripts/collect_moneta_conflicts.py`, `collect-moneta-conflicts.yml`).
- Moneta web pages: org-wide overview, needs-attention page (each fork with the reasons), filterable apps page (cards and table, CSV export), per-app detail (advisories, sync forecast, trend, badge snippet), app search in the palette.
- Moneta published data: fork status history, README badge endpoints, generated `VERSIONS.md`.
- Moneta accessibility and visual CI jobs with Linux baselines in `tests/baseline-web/moneta/`.
- `DASHBOARD_ORG` selects the active org config folder.
- Wording the web app shows (page title, scoring provenance, catalog names, governance body) comes from the org's `org_branding.yaml` and is exported in `meta.json`; leaving it out gives neutral wording.
- `parse_rule: boolean` scores any metric, replacing a check on two metric names.

### Changed
- `deploy-web.yml` bundles every org folder on the `data` branch.
- The web app is split into tenants (`web/src/tenants/`): each registers its own routes, nav, nav counts and search. `meta.json` gains an optional `pages` list, and `signals`, `snapshot_url`, `history_url` and `config_version` are optional.
- `data-freshness` checks every org on the `data` branch against its own `stale_threshold_hours`.
- `web_audit.py --org` audits one tenant; baselines moved to `tests/baseline-web/<org>/`.

## [1.0.0] - 2026-05-19
Initial release of Phase 1 implementation

### Added
- Repository health dashboard with Streamlit
- 9-metric scoring system with CHAOSS mapping
- Historical trend analysis and delta detection
- Deep linking with query params
- Configurable remediation system
- Full config validation and fallback system
- Documentation and configuration files

### Changed
- Full directory structure reorganization
- Complete implementation of all Phase 1 requirements

### Removed
- Legacy single-file implementation
- Unnecessary dependencies

### Security
- AGPL-3.0-or-later license

### Deprecations
- None

### Breaking Changes
- None

[1.0.0]: https://github.com/UsamaSadiq/OSSvitals/compare/v1.0.0...v1.0.0