# Dashboard Configuration

This directory contains OSSvitals configuration: global flags plus one folder per tenant.

## Layout

- `feature_flags.yaml`: global feature toggles.
- `tenants.json`: every tenant with its kind (`health` or `fleet`) and site; bundled by the web app and the MCP server, read by the fleet and health workflows. JSON because both bundlers import it without a plugin.
- `<org>/*.yaml`: one folder per tenant, named after the GitHub organization. At least `org_branding.yaml` is required; see [Adding a tenant](../../docs/RUNBOOK.md#adding-a-tenant).
  - `openedx/`: Open edX, a health tenant (tiers, remediation, PR templates, campaigns, waves, support windows, its stewardship rule settings in `attention_rules.yaml`); `health.yaml` turns on the Open edX ecosystem collectors. Scoring and check metadata come from `_kinds/health/`.
  - `moneta/`: Pressingly (Moneta), a fleet tenant: `apps.yaml` is the app inventory, `fleet.yaml` overrides the fleet defaults.
- `_kinds/fleet/defaults.yaml`: defaults every fleet tenant's `fleet.yaml` is merged over (signals, status ladder, branches).
- `_kinds/health/defaults.yaml`: defaults every health tenant's optional `health.yaml` is merged over (pages, maintenance collectors).
- `_kinds/health/<section>.yaml`: the kind's default for a config section (`scoring`, `scoring_proposed`, `check_groups`, `check_descriptions`, `strings`, `attention_rules`, `redact`). `get_config` merges a health tenant's own `<org>/<section>.yaml` over it (mappings key by key, lists replace); a tenant without its own file gets the default. Orgs outside `tenants.json` read only their own folder.
- `schemas/*.schema.json`: JSON Schemas used to validate config payloads at load time.

## Validation Behavior

- Runtime: non-fatal. Invalid config is logged and the dashboard continues running.
- Strict mode: CI/tests may enable strict validation and fail on invalid payloads.

## Schema Coverage

- `feature_flags.schema.json`
- `data_source.schema.json`
- `check_groups.schema.json`
- `check_descriptions.schema.json`
- `remediation.schema.json`
- `pr_templates.schema.json`
- `scoring.schema.json`
- `tiers.schema.json`
- `attention_rules.schema.json`
- `strings.schema.json`
- `org_branding.schema.json`
- `fleet.schema.json` (merged fleet settings)
- `tenants.schema.json`
- `apps.schema.json`
