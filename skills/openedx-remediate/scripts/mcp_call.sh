#!/usr/bin/env bash
# Usage: mcp_call.sh <tool> ['<json arguments>']
# Calls the OSSvitals Open edX MCP endpoint over Streamable HTTP when no MCP connector is configured.
set -euo pipefail
ENDPOINT="${OSSVITALS_MCP_ENDPOINT:-https://mcp.ossvitals.org/openedx/mcp}"
TOOL="${1:?tool name required}"
ARGS="${2:-{\}}"

post() {
  curl -sS -X POST "$ENDPOINT" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "$1" | sed -n 's/^data: //p'
}

post '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"openedx-remediate","version":"0.1"}}}' >/dev/null
post "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"$TOOL\",\"arguments\":$ARGS}}" \
  | python3 -I -c 'import json,sys
reply = json.loads(sys.stdin.read())
if "error" in reply:
    sys.exit("MCP error: " + json.dumps(reply["error"]))
print(reply["result"]["content"][0]["text"])'
