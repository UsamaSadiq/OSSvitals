# Dashboard Configuration

This directory contains OSSvitals configuration: global flags plus one folder per tenant.

## Layout

- `feature_flags.yaml`: global feature toggles.
- `<org>/*.yaml`: one folder per tenant, named after the GitHub organization. At least `org_branding.yaml` is required; see [Adding a tenant](../../docs/RUNBOOK.md#adding-a-tenant).
  - `openedx/`: Open edX, a health tenant (scoring, checks, remediation, PR templates).
  - `moneta/`: Pressingly (Moneta), a fleet tenant: `apps.yaml` is the app inventory, `fleet.yaml` overrides the fleet defaults.
- `_kinds/fleet/defaults.yaml`: defaults every fleet tenant's `fleet.yaml` is merged over (signals, status ladder, branches).
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
- `apps.schema.json`
