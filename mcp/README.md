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

Every endpoint has `list_tenants`. The rest depend on the tenant kind set in `src/tenants.ts`.

Health tenants (`openedx`):

| Tool | Arguments | Returns |
|---|---|---|
| `get_overview` | none | KPIs with deltas, grade mix, top failing checks, gainers and losers |
| `list_repos` | `letter`, `tier`, `failing_check`, `owner`, `min_score`, `max_score`, `sort`, `page`, `page_size` | paged repo rows with score, letter, tier, failing count, last push, owner |
| `get_repo` | `repo` (with or without the `openedx/` prefix) | score, subscores, owners, failing checks with titles and whether a remediation exists |
| `get_check` | `check` | description, pass rate, remediation snippet and PR template when defined |
| `list_needing_attention` | `page`, `page_size` | repos flagged by the attention rules with their reasons |

Drift tenants (`moneta`):

| Tool | Arguments | Returns |
|---|---|---|
| `list_apps` | `status`, `class` | each tracked repo with its sync status, distances and severe advisory count |
| `get_app` | `repo` | the app record merged with its drift record, advisories as counts |
| `get_conflict_forecast` | `repo` | files a sync would conflict on, against upstream head and the latest release |

Responses are compact JSON projections of the published views, never whole files. Free text that
originates in third-party repositories (descriptions, change notes) is truncated to 300 characters and
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
