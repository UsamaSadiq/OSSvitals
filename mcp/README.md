# OSSvitals MCP server

Read-only remote [MCP](https://modelcontextprotocol.io) server that exposes the published OSSvitals
views to AI agents. It runs as a Cloudflare Worker (`ossvitals-mcp`) and reads the same public JSON
files the dashboards render. All data is public, there is no authentication, and no tool can change
anything.

## Endpoints

- `https://mcp.ossvitals.org/mcp` - root endpoint, lists tenants
- `https://mcp.ossvitals.org/openedx/mcp` - Open edX
- `https://mcp.ossvitals.org/moneta/mcp` - Moneta
- `https://mcp.ossvitals.org/healthz` - liveness check

Requests are rate limited per client IP (100 per minute); excess requests get `429` with `Retry-After`.

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
