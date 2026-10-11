# Architecture

## Overview

A static web app fed by pre-computed files. Nothing calls an API at runtime.

- Web app: [web](../web), built and served by Cloudflare
- Domain logic: [dashboard/lib](../dashboard/lib)
- Pipeline entry points: [scripts](../scripts) and [collectors](../collectors)
- Configuration: [dashboard/config](../dashboard/config), one folder per org

## Data flow

1. Source CSVs come from the URLs in the org's `data_source.yaml`.
2. `build-scores` loads the snapshot, checks its shape, scores it with `scoring.yaml`, and writes `scores.json` and page-ready `views/` to the `data` branch.
3. `collect-maintenance` publishes upgrade jobs, waves and redundant PRs to the same branch.
4. `data-freshness` opens an issue when any source is over 2 days old.
5. The web app reads those files only.

## Selecting the org

`DASHBOARD_ORG` (default `openedx`) picks the config folder; the pipeline scripts also take `--org`.

## Config validation

Config files are validated against JSON Schemas in [dashboard/config/schemas](../dashboard/config/schemas).
Runtime validation is non-fatal; strict validation should be used in CI.
