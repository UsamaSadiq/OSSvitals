# Open edX Repository Health Dashboard

![License](https://img.shields.io/badge/License-AGPL3.0-blue.svg)

The Open edX Repository Health Dashboard is a community tool that provides visualization and analytical capabilities for Open edX repository health metrics. The project is licensed under AGPL-3.0-or-later.

This is an unofficial community project. It is not affiliated with or endorsed by Axim Collaborative. Open edX is a registered trademark of Axim Collaborative.

**Live dashboard:** https://openedx-health-dashboard.streamlit.app/

## Key Features
- 9-metric scoring system cross-referenced to CHAOSS metrics and OpenSSF Scorecard checks
- Historical trend analysis and delta detection
- Deep linking and filter-preserving exports
- Configurable remediation snippets and auto-PR generation
- Org-specific configuration and visualization rules

## Scoring and independence
How scores are computed (metrics, weights, thresholds, grade bands, missing-data policy) is shown on the dashboard's **How Scoring Works** page, generated from [scoring.yaml](dashboard/config/openedx/scoring.yaml).

Every check, weight, threshold and score for public repositories stays open and reproducible.

Scores are not estimates. They are computed by that published method from real data that the Open edX repo health checks collect from every repository through daily jobs. Labels such as "at risk" describe what those checks measure, not a judgement of any project or person. The dashboard is provided without warranty; to report an error or ask for a correction, open an issue on this repository.

## Contributing
Contributions are accepted under AGPL-3.0-or-later with a DCO sign-off. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy
What the dashboard shows about people, and how to ask for a correction: [docs/PRIVACY.md](docs/PRIVACY.md).
