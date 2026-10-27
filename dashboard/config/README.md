# Dashboard Configuration

This directory contains OSSvitals configuration: global flags plus one folder per tenant.

## Layout

- `feature_flags.yaml`: global feature toggles.
- `<org>/*.yaml`: one folder per tenant, named after the GitHub organization. At least `org_branding.yaml` is required; see [Adding a tenant](../../docs/RUNBOOK.md#adding-a-tenant).
  - `openedx/`: Open edX, a health tenant (scoring, checks, remediation, PR templates).
  - `moneta/`: Pressingly (Moneta), a drift tenant: `apps.yaml` is the app inventory, `status.yaml` the drift status thresholds.
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
- `status.schema.json`
- `apps.schema.json`
