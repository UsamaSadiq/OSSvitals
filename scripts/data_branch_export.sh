#!/usr/bin/env bash
#
# Extract every tenant's views/ and maintenance/ folders from the `data` branch.
#
#   scripts/data_branch_export.sh <out-dir>
#
# The web build bundles these folders and sync-data.yml mirrors them to R2, so
# both read the same set of files.
set -euo pipefail

out_dir="$1"
git fetch --depth 1 origin data
mkdir -p "$out_dir"
paths=()
for org in $(git ls-tree -d --name-only FETCH_HEAD); do
  for folder in views maintenance; do
    if git cat-file -e "FETCH_HEAD:$org/$folder" 2>/dev/null; then paths+=("$org/$folder"); fi
  done
done
git archive FETCH_HEAD "${paths[@]}" | tar -x -C "$out_dir"
