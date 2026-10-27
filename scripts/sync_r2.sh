#!/usr/bin/env bash
#
# Upload every JSON file under a directory to an R2 bucket, keyed by its relative path.
#
#   scripts/sync_r2.sh <dir> <bucket>
#
# Needs wrangler on PATH plus CLOUDFLARE_API_TOKEN (R2 write) and CLOUDFLARE_ACCOUNT_ID.
set -euo pipefail

dir="$1"
bucket="$2"
parallel_uploads=6

cd "$dir"

upload() {
  sed 's#^\./##' | xargs -P "$parallel_uploads" -I{} \
    wrangler r2 object put "$bucket/{}" --file "{}" --content-type "application/json; charset=utf-8" --cache-control no-cache --remote --force
}

# Each org's views/meta.json goes last: the site trusts the data host for an org only once its meta.json checks out.
find . -type f -name '*.json' ! -path '*/views/meta.json' | upload
find . -type f -path '*/views/meta.json' | upload
