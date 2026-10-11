#!/usr/bin/env bash
#
# Run scripts/web_audit.py inside the same container CI uses.
#
#   scripts/web_audit_container.sh --mode diff
#   scripts/web_audit_container.sh --mode baseline   # review and commit
#   scripts/web_audit_container.sh --mode a11y
#
# Why this exists: the screenshot baselines in tests/baseline-web/ are
# byte-compared, and text rasterisation differs between operating systems. A
# baseline captured on macOS fails against a Linux runner on font rendering
# alone, and any tolerance loose enough to absorb that is too loose to catch a
# clipped axis label. So there is exactly one reference environment, this image,
# and everyone renders in it.
#
# The image is pinned by digest, not by tag. A tag is a mutable pointer, and this
# one is rebuilt for OS security patches — a freetype or fontconfig change moves
# text rasterisation. CI pulls fresh on every job while Docker here reuses an
# already-present tag, so the two would silently drift apart and reintroduce the
# cross-machine font failure this script exists to prevent. The digest must stay
# in step with the `container:` image in .github/workflows/web-audit.yml and with
# the playwright pin in requirements-dev.txt.
set -euo pipefail

IMAGE="mcr.microsoft.com/playwright/python:v1.60.0-noble@sha256:8ff591d613b01c884cc488339ed4318b4513eaf0c57a164a878ba49e70e3f384"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! docker info >/dev/null 2>&1; then
  echo "error: Docker is not running. Start Docker Desktop (or your daemon) and retry." >&2
  echo "       Without it, baselines captured here will not match CI." >&2
  exit 1
fi

# A named volume for pip's download cache, so the dependency install is a local
# unpack (a few seconds) rather than a re-download on every invocation. Only a
# cache: the install itself still runs each time, which is what keeps this
# identical to the CI step rather than merely similar. Drop it with
# `docker volume rm ossvitals-audit-pip` if it ever misbehaves.
PIP_CACHE_VOLUME="ossvitals-audit-pip"
AUDIT_SCRIPT="${AUDIT_SCRIPT:-scripts/web_audit.py}"

# -t only when stdout is a terminal, so CI and pipes still work.
TTY_FLAG=()
[ -t 1 ] && TTY_FLAG=(-t)

# Run as the invoking user on Linux, where the bind mount shares the host's uid
# namespace: as root, everything the run *creates* — .ux-audit/web-current/,
# .ux-audit/web-diff/ — lands root-owned on the host. The next plain
# `python scripts/web_audit.py` then fails, and confusingly: web_audit.py clears
# .ux-audit/web-current with `ignore_errors=True`, so the denied removal is silent
# and the run dies later on a PermissionError writing into it. Recovery needs
# sudo, for what looked like a harness bug.
#
# Docker Desktop (macOS, Windows) already maps ownership back to the invoking
# user, and passing -u there would instead break the image's own paths, so this
# is Linux-only. Non-root means the install cannot write to system site-packages,
# hence --user and PYTHONUSERBASE below.
USER_FLAG=()
PIP_TARGET_FLAG="--break-system-packages"
if [ "$(uname -s)" = "Linux" ]; then
  USER_FLAG=(-u "$(id -u):$(id -g)")
  PIP_TARGET_FLAG="--user"
fi

# CI runners are amd64. On an arm64 host (Apple Silicon) the same image digest
# resolves to its arm64 variant, which rounds text layout differently by a
# sub-pixel, so baselines captured natively there fail CI on single rows.
exec docker run --rm --platform linux/amd64 "${TTY_FLAG[@]}" "${USER_FLAG[@]}" \
  -v "$REPO_ROOT":/work \
  -v "$PIP_CACHE_VOLUME":/pip-cache \
  -w /work \
  -e HOME=/tmp \
  -e PIP_CACHE_DIR=/pip-cache \
  -e PYTHONUSERBASE=/tmp/pybase \
  -e PYTHONDONTWRITEBYTECODE=1 \
  -e PIP_TARGET_FLAG="$PIP_TARGET_FLAG" \
  -e AUDIT_SCRIPT="$AUDIT_SCRIPT" \
  "$IMAGE" \
  bash -euc '
    # The same install the workflow runs. The image is externally managed, so
    # --break-system-packages is what puts these alongside its preinstalled
    # playwright — the same flag, into the same interpreter, as CI. The
    # non-root Linux path uses --user instead, which resolves to the same
    # interpreter and the same pinned versions.
    export PATH="/tmp/pybase/bin:$PATH"
    pip install --quiet "$PIP_TARGET_FLAG" -r requirements.txt -r requirements-dev.txt
    exec python "$AUDIT_SCRIPT" "$@"
  ' bash "$@"
