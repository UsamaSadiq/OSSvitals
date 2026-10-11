# Runbook

## Upstream outage

1. Verify the CSV URL in [dashboard/config/openedx/data_source.yaml](../dashboard/config/openedx/data_source.yaml).
2. Check the `data-freshness` workflow: it opens an issue when any source is over 2 days old.
3. The web app keeps serving the last published files from the `data` branch; publish status to users if the outage is long.

## Emergency pinning

1. Update `csv_url` to a known-good raw CSV snapshot URL.
2. Re-run the `build-scores` workflow and confirm it publishes fresh `scores.json` and `views/`.

## Adding a tenant

The web app follows the subdomain: `<org>.ossvitals.org` loads `data/<org>/views/*.json`. Everything org-specific lives in `dashboard/config/<org>/`:

1. Copy `dashboard/config/openedx/` to `dashboard/config/<org>/` and edit it. Wording the web app shows comes from `org_branding.yaml` (`name`, `site_title`, `provenance`, `catalog`, `footer`) and `attention_rules.yaml` (`unmaintained_group`, `catalog_url_template`). Every key under `provenance` and `catalog` is optional; leaving one out makes the page use neutral wording.
2. Set `data_source.yaml` (`csv_url`, `history_repo`, `github_org`) and `scoring.yaml`. A metric of `parse_rule: boolean` needs no code.
3. Add a build step for `--org <org>` to `build-scores.yml` and `collect-maintenance.yml`, so the `data` branch gains `<org>/views`.
4. Add the route in `web/wrangler.json` (`<org>.ossvitals.org`, custom domain). `deploy-web.yml` already bundles every org folder on the `data` branch.
5. List the live dashboard on `sites/landing/public/index.html` once it is public.

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
  viewport into `.ux-audit/web-current/`. Use it to look at a change, not to gate it.
- `python scripts/web_audit.py --mode a11y` runs the axe-core scan with no
  allowlist and exits 1 on any violation.
- `python scripts/web_audit.py --mode baseline` overwrites the committed
  reference PNGs in `tests/baseline-web/<viewport>/<page>.png`.
- `python scripts/web_audit.py --mode diff` compares a fresh capture against those
  baselines, writes diff images to `.ux-audit/web-diff/`, and exits 1 on a
  regression. CI runs this as a blocking gate.

Run `diff` and `baseline` through the container (below). Everything under
`.ux-audit/` is transient and gitignored; everything under `tests/baseline-web/`
is tracked.

### Baseline review workflow

Baselines are reviewed like code. A diff to `tests/baseline-web/` in a pull
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
in its `web-current/` folder, and copy only the expected ones into
`tests/baseline-web/` before committing.

### Refreshing the data fixture

Rarely, and never to make a red gate green. See
[tests/fixtures/data/README.md](../tests/fixtures/data/README.md).

### Licence note

axe-core 4.10.2 is vendored at `scripts/webaudit/vendor/axe.min.js` under the
Mozilla Public License 2.0. It is an unmodified redistribution. Keep the licence
header intact, and see
[scripts/webaudit/vendor/README.md](../scripts/webaudit/vendor/README.md) for the
checksum, the upstream source, and the upgrade procedure.
