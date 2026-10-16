#!/usr/bin/env bash
# Usage: mcp_call.sh <tool> ['<json arguments>']
# Calls the OSSvitals Open edX MCP endpoint over Streamable HTTP when no MCP connector is configured.
set -euo pipefail
ENDPOINT="${OSSVITALS_MCP_ENDPOINT:-https://mcp.ossvitals.org/openedx/mcp}"
TOOL="${1:?tool name required}"
ARGS="${2:-{\}}"

python3 -I -c 'import json, sys; json.loads(sys.argv[1])' "$ARGS" 2>/dev/null \
  || { echo "arguments are not valid JSON: $ARGS" >&2; exit 2; }

post() {
  curl -sS --fail-with-body -X POST "$ENDPOINT" \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json, text/event-stream' \
    -d "$1" | sed -n 's/^data: //p'
}

request() {
  python3 -I -c 'import json, sys
print(json.dumps({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                  "params": {"name": sys.argv[1], "arguments": json.loads(sys.argv[2])}}))' "$TOOL" "$ARGS"
}

post '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"openedx-remediate","version":"0.1"}}}' >/dev/null
post "$(request)" | python3 -I -c 'import json, sys
raw = sys.stdin.read().strip()
if not raw:
    sys.exit("MCP transport error: empty or non-SSE response from " + sys.argv[1])
reply = json.loads(raw)
if "error" in reply:
    sys.exit("MCP error: " + json.dumps(reply["error"]))
result = reply["result"]
text = result["content"][0]["text"]
if result.get("isError"):
    sys.exit("MCP tool error: " + text)
print(text)' "$ENDPOINT"
