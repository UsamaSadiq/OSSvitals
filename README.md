# OSSvitals

![License](https://img.shields.io/badge/License-AGPL3.0-blue.svg)

OSSvitals grades the repository health of a GitHub organization, every day, on a published method. Each tenant is one organization with its own scoring configuration and dashboard. The project is licensed under AGPL-3.0-or-later.

**Live tenants:**
- Open edX: https://openedx.ossvitals.org/ (169 repositories)
- Moneta: https://moneta.ossvitals.org/

OSSvitals is an unofficial community project. It is not affiliated with or endorsed by Axim Collaborative or any tenant organization. Open edX is a registered trademark of Axim Collaborative.

## Key Features
- 9-metric scoring system cross-referenced to CHAOSS metrics and OpenSSF Scorecard checks
- Historical trend analysis and delta detection
- Deep linking and exports
- Configurable remediation snippets and auto-PR generation
- Per-tenant configuration and visualization rules

## Scoring and independence
How scores are computed (metrics, weights, thresholds, grade bands, missing-data policy) is shown on each dashboard's **How Scoring Works** page, generated from that tenant's `scoring.yaml` (for example [dashboard/config/openedx/scoring.yaml](dashboard/config/openedx/scoring.yaml)).

Every check, weight, threshold and score for public repositories stays open and reproducible.

Scores are not estimates. They are computed by that published method from real data that the repo health checks collect from every repository through daily jobs. Labels such as "at risk" describe what those checks measure, not a judgement of any project or person. The dashboard is provided without warranty; to report an error or ask for a correction, open an issue on this repository.

## Connect an agent
The published data is also served over the Model Context Protocol, read-only and without auth, at `https://mcp.ossvitals.org/<tenant>/mcp` (for example `openedx` or `moneta`). Add it as a custom connector in claude.ai, or in Claude Code:

```bash
claude mcp add --transport http ossvitals https://mcp.ossvitals.org/openedx/mcp
```

Tools, limits and local development are described in [mcp/README.md](mcp/README.md).

To act on what the dashboard reports, `skills/openedx-remediate/` is a Claude Code skill that turns one failing check on an Open edX repository into one validated draft pull request on your own fork, refusing with evidence when the fix would be wrong for that repo. Install it with `ln -s "$PWD/skills/openedx-remediate" ~/.claude/skills/openedx-remediate` and see [skills/openedx-remediate/SKILL.md](skills/openedx-remediate/SKILL.md).

## Adding a tenant
A tenant is a GitHub organization with its own folder under `dashboard/config/<tenant>/` (at least `org_branding.yaml`), its own collector and its own pages. Open an issue describing the organization and which checks it already runs, or follow the steps in [docs/RUNBOOK.md](docs/RUNBOOK.md#adding-a-tenant).

## Contributing
Contributions are accepted under AGPL-3.0-or-later with a DCO sign-off. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Privacy
What the dashboard shows about people, and how to ask for a correction: [docs/PRIVACY.md](docs/PRIVACY.md).
