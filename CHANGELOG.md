# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.2/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed
- The Streamlit dashboard, its UI tests, screenshot baselines and audit harness. The web app is the only front end.
- `streamlit`, `plotly`, `duckdb`, `rapidfuzz` and `pydantic` dependencies.

### Added
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