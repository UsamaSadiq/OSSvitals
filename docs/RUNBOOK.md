# Runbook

## Upstream outage

1. Verify the CSV URL in [dashboard/config/openedx/data_source.yaml](../dashboard/config/openedx/data_source.yaml).
2. Check the `data-freshness` workflow: it opens an issue when any source is over 2 days old.
3. The web app keeps serving the last published files from the `data` branch; publish status to users if the outage is long.

## Emergency pinning

1. Update `csv_url` to a known-good raw CSV snapshot URL.
2. Re-run the `build-scores` workflow and confirm it publishes fresh `scores.json` and `views/`.

## Tenants

Each tenant owns its collector, its view files and its pages. They share only a thin contract, so one tenant's setup never blocks another.

### The tenant contract

A tenant is complete when `data/<org>/views/meta.json` exists on the `data` branch and every other view file its own pages read is present. The web app follows the subdomain: `<org>.ossvitals.org` loads `data/<org>/views/*.json`.

`meta.json` requires:
- `metadata` (`org`, `generated_at`, `snapshot_timestamp`, `schema_version`, `source`)
- `branding` (`name`, `short_name`, `tagline`; optional `site_title`, `provenance`, `catalog`, `footer`, `colors`)
- `feature_flags` (`enable_maintainer_views`)
- `stale_threshold_hours` and `critically_stale_threshold_hours`

and optionally `pages` (the paths the nav shows; omit it to show every page the tenant defines), `github_org`, `unmaintained_group`, and the openedx-shaped `config_version`, `signals`, `snapshot_url` and `history_url`. All other view schemas belong to the tenant.

### Adding a tenant

1. Add `dashboard/config/<org>/` with at least `org_branding.yaml`. Wording the web app shows comes from there; every key under `provenance` and `catalog` is optional and a missing key gives neutral text.
2. Write the tenant's collector and publish its views under `<org>/views/` on the `data` branch. It does not need a CSV, scoring or the openedx pipeline. If it uses the Python pipeline, a metric with `parse_rule: boolean` needs no code.
3. Add a tenant module in `web/src/tenants/<org>/index.tsx` (nav sections, routes, optional nav counts and palette host) and register it in `web/src/tenants/registry.ts`. An org with no module falls back to openedx.
4. Add the route in `web/wrangler.json` (`<org>.ossvitals.org`, custom domain). `deploy-web.yml` bundles `views` and `maintenance` for every org folder on the `data` branch.
5. Freshness needs nothing: `data-freshness.yml` checks every org that has `views/meta.json`, using that file's `stale_threshold_hours`.
6. Visual and accessibility gates: add a page inventory in `scripts/webaudit/pages.py` (`PAGES_BY_ORG`) and view fixtures in `tests/fixtures/<org>/views/`. Build the web app with `VITE_DEFAULT_ORG=<org>` and run `python scripts/web_audit.py --org <org> --dist <dir> --mode a11y`. Baselines live in `tests/baseline-web/<org>/`; generate them in CI (see below) and add a job to `.github/workflows/web-audit.yml` once the tenant has pages worth guarding.
7. List the dashboard on `sites/landing/public/index.html` once it is public.

## Validation checks

- Run tests: `python -m pytest -q tests`

## Web audit harness

[scripts/web_audit.py](../scripts/web_audit.py) captures screenshots and runs an
accessibility scan against a built `web/dist`. It serves it like the Cloudflare
Worker (SPA fallback and `_headers`, so a CSP violation fails the run). Views come
from the pinned fixture at a frozen instant, and the browser clock is frozen to
match.

### Setup

1. `pip install -r requirements-dev.txt`
2. `playwright install chromium`
3. `cd web && npm ci && npm run build`

Step 2 downloads the browser binary and is not optional.

### Modes

- `python scripts/web_audit.py --mode screenshots` captures every route at every
  viewport into `.ux-audit/web-current/<org>/`. Use it to look at a change, not to gate it.
- `python scripts/web_audit.py --mode a11y` runs the axe-core scan with no
  allowlist and exits 1 on any violation.
- `python scripts/web_audit.py --mode baseline` overwrites the committed
  reference PNGs in `tests/baseline-web/<org>/<viewport>/<page>.png`.
- `python scripts/web_audit.py --mode diff` compares a fresh capture against those
  baselines, writes diff images to `.ux-audit/web-diff/<org>/`, and exits 1 on a
  regression. CI runs this as a blocking gate.

Run `diff` and `baseline` through the container (below). Everything under
`.ux-audit/` is transient and gitignored; everything under `tests/baseline-web/`
is tracked.

### Baseline review workflow

Baselines are reviewed like code. A diff to `tests/baseline-web/<org>/` in a pull
request is a claim that the visual change is intentional, and a reviewer is
expected to open the images and agree with that claim.

1. Make the change, then run `--mode diff`.
2. If it fails, open the diff images and work out why.
3. Only once the change is understood and wanted, run `--mode baseline` and
   commit the updated PNGs alongside the code change that justifies them.

Never regenerate baselines to turn a red gate green.

### What makes the diff reproducible

| Input | Pinned by | Without it |
|---|---|---|
| The two upstream CSVs | `tests/fixtures/data/`, via `DASHBOARD_DATA_FIXTURE` | Upstream churn repaints the page with no code change |
| The clock | `DASHBOARD_FROZEN_NOW`, via [dashboard/lib/clock.py](../dashboard/lib/clock.py), plus the browser clock | The freshness chip, staleness banner and at-risk rules re-render every day |
| Set iteration order | `PYTHONHASHSEED=0` | Any view building a list from a set shuffles between runs |
| The build's commit | `GITHUB_SHA`, overwritten by the harness | The bulletin's commit line changes on every commit |
| Tie order in every ranking | [dashboard/lib/ordering.py](../dashboard/lib/ordering.py) | Repos on equal scores permute between machines |

Captures wait until every chart's rendered size stops changing, because charts
re-render when their container resizes. A flaky diff almost always means some
value is still unpinned: find it and fix it at the source rather than adding a
mask.

### Baselines are Linux-rendered, so use the container

Text rasterisation differs between operating systems by far more than the gate's
tolerance. There is one reference environment, the pinned
`mcr.microsoft.com/playwright/python` image, and both CI and contributors render
in it:

```bash
cd web && npm run build && cd ..
scripts/web_audit_container.sh --mode diff
scripts/web_audit_container.sh --mode baseline   # review and commit
python scripts/web_audit.py --mode a11y
```

The image is pinned by digest, not tag, because a tag is rebuilt for OS security
patches and a freetype or fontconfig change moves text rasterisation. The digest
appears in three places that must agree: the `container:` key in
`.github/workflows/web-audit.yml`, `IMAGE` in
[scripts/web_audit_container.sh](../scripts/web_audit_container.sh), and the
`playwright` pin in [requirements-dev.txt](../requirements-dev.txt). To move it:

```bash
docker pull mcr.microsoft.com/playwright/python:<new tag>
docker image inspect mcr.microsoft.com/playwright/python:<new tag> \
  --format '{{index .RepoDigests 0}}'
```

Update all three, regenerate the baselines in the same commit, and say in the
message that the image moved.

On Apple Silicon the container runs amd64 under emulation and can be flaky
(timeouts, partial captures). When it is, take the baselines from CI instead:
download the `web-visual-diff` artifact from the failing run, review every image
in its `web-current/<org>/` folder, and copy only the expected ones into
`tests/baseline-web/<org>/` before committing.

### Refreshing the data fixture

Rarely, and never to make a red gate green. See
[tests/fixtures/data/README.md](../tests/fixtures/data/README.md).

### Licence note

axe-core 4.10.2 is vendored at `scripts/webaudit/vendor/axe.min.js` under the
Mozilla Public License 2.0. It is an unmodified redistribution. Keep the licence
header intact, and see
[scripts/webaudit/vendor/README.md](../scripts/webaudit/vendor/README.md) for the
checksum, the upstream source, and the upgrade procedure.
