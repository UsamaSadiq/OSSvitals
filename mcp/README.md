# OSSvitals MCP server

Read-only remote [MCP](https://modelcontextprotocol.io) server that exposes the published OSSvitals
views to AI agents. It runs as a Cloudflare Worker (`ossvitals-mcp`) and reads the same public JSON
files the dashboards render. All data is public, there is no authentication, and no tool can change
anything. If a tenant ever publishes private views, OAuth would sit in front of this Worker; routing
by tenant would not change.

## Endpoints

- `https://mcp.ossvitals.org/` - plain-text index of the endpoints
- `https://mcp.ossvitals.org/mcp` - root endpoint, lists tenants
- `https://mcp.ossvitals.org/openedx/mcp` - Open edX
- `https://mcp.ossvitals.org/moneta/mcp` - Moneta
- `https://mcp.ossvitals.org/healthz` - liveness check

Requests are rate limited per client IP (100 per minute); excess requests get `429` with `Retry-After`.

## Tools

Every endpoint has `list_tenants`. Every tenant endpoint also has `report_issue`. The rest depend on the
tenant kind set in `dashboard/config/tenants.json`.

| Tool | Arguments | Returns |
|---|---|---|
| `report_issue` | `kind` (`bug`, `data` or `question`), `title`, `details`, `repo`, `page` | a link to a prefilled GitHub issue form on the tenant's source repo. It files nothing: the user reviews and submits it, so the server stays read-only |

Health tenants (`openedx`):

| Tool | Arguments | Returns |
|---|---|---|
| `get_overview` | none | KPIs with deltas, grade mix, top failing checks, gainers and losers |
| `list_repos` | `letter`, `tier`, `failing_check`, `owner`, `min_score`, `max_score`, `sort`, `page`, `page_size` | paged repo rows with score, letter, tier, failing count, last push, owner |
| `get_repo` | `repo` (with or without the `openedx/` prefix) | score, subscores, owners, failing checks with titles, whether a remediation exists, and `fix_pr` (the newest open upstream PR carrying the OSSvitals marker for that check, or null) |
| `get_check` | `check` | description, pass rate, remediation snippet and PR template when defined |
| `list_needing_attention` | `page`, `page_size` | repos flagged by the attention rules with their reasons |

Fleet tenants (`moneta`):

| Tool | Arguments | Returns |
|---|---|---|
| `list_apps` | `status`, `class` | each tracked repo with its sync status, distances and severe advisory count |
| `get_app` | `repo` | the app record merged with its drift record, advisories as counts, and `weekly_signals` counts (carried patches, upgrade risks) |
| `get_conflict_forecast` | `repo` | files a sync would conflict on, against upstream head and the latest release |
| `get_carried_patches` | `repo` | commits our fork carries on top of upstream and those upstream already has, counts plus the newest 20 of each |
| `get_upgrade_risk` | `repo` | migration numbering risks against upstream and upstream release notes since our base that read as breaking |

Responses are compact JSON projections of the published views, never whole files. Free text that
originates in third-party repositories (descriptions, change notes, commit subjects, release-note lines) is truncated to 300 characters and
the server instructions tell clients to treat it as data, not instructions. Page size is capped at 50.

## Connect

Claude Code:

```sh
claude mcp add --transport http ossvitals https://mcp.ossvitals.org/openedx/mcp
```

claude.ai: Settings, Connectors, Add custom connector, and paste the endpoint URL.

Cursor: add to `~/.cursor/mcp.json`:

```json
{ "mcpServers": { "ossvitals": { "url": "https://mcp.ossvitals.org/openedx/mcp" } } }
```

## Development

```sh
npm ci
npm run check
npm run dev
```

`npm run dev` serves `http://localhost:8787`, for example `/openedx/mcp`. Rerun `npm run types` after
changing `wrangler.json`.

Schemas are imported from `../web/src`, so `zod` is aliased to `mcp/node_modules/zod` in
`tsconfig.json` and `wrangler.json`.
