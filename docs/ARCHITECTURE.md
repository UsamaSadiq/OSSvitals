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
6. The MCP server ([mcp](../mcp)) reads the same files on behalf of agents.

## MCP server

A separate Cloudflare Worker at `mcp.ossvitals.org` exposes the published views to MCP clients
(claude.ai, Claude Code, Cursor). It is stateless and read-only: each request fetches the view files
from the tenant's site, caches them for five minutes, and returns compact projections. It holds no
secrets and has no write tools. The tenant is part of the path (`/<org>/mcp`); the root `/mcp`
endpoint lists tenants only. The tool set depends on the tenant kind in `mcp/src/tenants.ts`
(`health` for the openedx pipeline, `drift` for fork tracking).

## Selecting the org

`DASHBOARD_ORG` (default `openedx`) picks the config folder; the pipeline scripts also take `--org`.

## Config validation

Config files are validated against JSON Schemas in [dashboard/config/schemas](../dashboard/config/schemas).
Runtime validation is non-fatal; strict validation should be used in CI.
