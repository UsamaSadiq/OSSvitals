# Runbook

## Upstream outage (openedx tenant)

The Open edX tenant reads a CSV published by `openedx/wg-maintenance`; other tenants run their own collectors and are not affected by this source.

1. Verify the CSV URL in [dashboard/config/openedx/data_source.yaml](../dashboard/config/openedx/data_source.yaml).
2. Check the `data-freshness` workflow: it opens an issue when any source is over 2 days old.
3. The web app keeps serving the last published files from the `data` branch; publish status to users if the outage is long.

## Emergency pinning

1. Update `csv_url` to a known-good raw CSV snapshot URL.
2. Re-run the `build-scores` workflow and confirm it publishes fresh `scores.json` and `views/`.

## Live data

The site does not rebuild when data changes. Each collector pushes to the `data` branch, `sync-data.yml` (on `workflow_run`) mirrors every tenant's `views/` and `maintenance/` folders to the public `ossvitals-data` R2 bucket, and the production build reads them from `https://data.ossvitals.org` (`VITE_DATA_BASE` in `deploy-web.yml`; local dev and the audit harness keep using `/data`). Objects carry `Cache-Control: no-cache`, so browsers revalidate by ETag. `deploy-web.yml` runs only for code changes, and the MCP Worker reads the same host. The build still bundles the `data` branch under `/data` as a fallback. Once per session and org, the site checks `meta.json` on the data host (5 second deadline, and its `schema_version` must match the build). If that fails, it logs a console warning and reads every view for that org from the bundled copy, so all views and the freshness banner describe the same snapshot. The bundled copy is as old as the last code deploy, and the banner only flags it once it passes the stale threshold. After the check passes, a view that fails on the data host shows an error rather than falling back.

Everything in `ossvitals-data` is public. A private tenant needs its own bucket with access control in front of it, and its files must stay off the `data` branch, which `sync-data.yml` copies wholesale.

Between daily runs the `ossvitals-events` Worker (`events/`) refreshes the maintenance files per repo. Every two minutes it lists openedx repos by `pushed_at` (ETag, so an unchanged list is free) and searches PRs updated since its last look, then dispatches `collect-maintenance.yml` with `repos=<names>` once the workflow is idle and at least `MIN_DISPATCH_GAP_MINUTES` after the last dispatch. That run merges the refreshed repos into the published files (`collect_maintenance.py --merge`) and keeps the full run's `generated_at`, so `data-freshness` still notices a broken daily run; `refreshed_at` and `refreshed_repos` record the partial run, and the pages show it. The watcher keeps its watermarks in the private `ossvitals-events-state` bucket.

Limits:
- Upgrade-job health stays daily: workflow runs show up in neither signal.
- Both signals over-include (any branch push, PR comments), which only costs a few extra API calls per run.
- Both GitHub listings are eventually consistent and the watermarks have no overlap, so a push or PR update that shows up after a newer one was already seen waits for the next daily run.
- Each poll reads at most 300 repos and 300 PRs. After a long outage (an expired token, a paused Worker), anything older than that waits for the next daily run.
- A repo leaves `pending` once the dispatch is accepted, not once the run succeeds, so a partial run that fails waits for the next daily run. A rejected dispatch keeps the repos in `pending`, and the watermarks still move on.
- `build-scores.yml` and `collect-maintenance.yml` both write `openedx/views` but keep separate concurrency groups, since a shared group would let a newer queued run cancel the pending one. Instead each publish step clones `data`, builds on that clone (build-scores builds its views from the clone's `openedx/maintenance`), and pushes; a rejected push starts over from a fresh clone, up to three times.
- A maintenance run that started before a scoring-code change on `main`, and whose push is retried after build-scores published, re-publishes views built by the older code until the next refresh or daily run.
- Files removed from the `data` branch stay in R2 until deleted by hand.

### Setting it up

Run wrangler from `events/` (it has wrangler installed), in this order:
1. Create both buckets: `npx wrangler r2 bucket create ossvitals-data` and `npx wrangler r2 bucket create ossvitals-events-state`.
2. Let any site read the public bucket: `npx wrangler r2 bucket cors set ossvitals-data --file ../scripts/r2_cors.json`.
3. Connect `data.ossvitals.org` to `ossvitals-data` (R2 → bucket → Settings → Custom Domains, or `npx wrangler r2 bucket domain add ossvitals-data --domain data.ossvitals.org --zone-id <ossvitals.org zone id>`). Leave `ossvitals-events-state` without a domain or public access.
4. Seed the public bucket locally, since `sync-data.yml` cannot be dispatched until it is on `main`: `scripts/data_branch_export.sh <dir> && scripts/sync_r2.sh <dir> ossvitals-data` (wrangler on PATH, logged in), then check `curl -sI https://data.ossvitals.org/openedx/views/meta.json`. Give the `CLOUDFLARE_API_TOKEN` repo secret R2 edit permission so the workflow can take over after the merge.
5. Create a fine-grained token with `Actions: read and write` on `UsamaSadiq/OSSvitals` only. Check it can read openedx too; this should print `200` and `x-ratelimit-limit: 30`, otherwise use a classic token with `public_repo`:
   ```
   curl -sS -H "Authorization: Bearer $TOKEN" "https://api.github.com/search/issues?q=org:openedx+is:pr&per_page=1" -D - -o /dev/null | grep -iE "^HTTP|ratelimit-limit"
   ```
6. Deploy the watcher and store the token, so it never ticks without one: `npx wrangler deploy && pbpaste | tr -d '\n' | npx wrangler secret put GITHUB_TOKEN` (`secret put` reads stdin when there is no terminal, so piping avoids storing an empty secret). Deploying before the merge is fine: `main` rejects the dispatches until `collect-maintenance.yml` has the `repos` input, and the changed repos wait in `pending`.
7. Merge; `deploy-web.yml` rebuilds the site against `data.ossvitals.org`, `deploy-mcp.yml` picks up the new `VIEWS_BASE`, and `deploy-events.yml` redeploys the watcher (the secret survives).
8. Watch the first ticks with `npx wrangler tail ossvitals-events`. The first one only records watermarks.

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

`dashboard/config/tenants.json` lists every tenant with its kind (`health` or `fleet`) and site. The web app and the MCP server bundle it at build time, and the fleet workflows run once per fleet org in it.

A **fleet** tenant (a company's forks of open source apps) needs no code:

1. Add `dashboard/config/<org>/` with `org_branding.yaml`, `apps.yaml` and `fleet.yaml` (only the overrides of `_kinds/fleet/defaults.yaml`; an empty file means all defaults). Wording the web app shows comes from `org_branding.yaml`; every key under `provenance` and `catalog` is optional and a missing key gives neutral text.
2. Add the org to `dashboard/config/tenants.json` (`{"kind": "fleet", "site": "https://<org>.ossvitals.org"}`) and the route to `web/wrangler.json` (`<org>.ossvitals.org`, custom domain). `tests/test_tenant_index.py` checks that the folder, settings, inventory and route exist.
3. Merging deploys the web app and the MCP server (`mcp.ossvitals.org/<org>/mcp`); run `collect-fleet.yml` once to publish the first views instead of waiting for the schedule. `deploy-web.yml` bundles `views` and `maintenance` for every org folder on the `data` branch, `sync-data.yml` mirrors them to R2, and `data-freshness.yml` checks every org with `views/meta.json`.
4. Optional visual and accessibility gates: add a page inventory in `scripts/webaudit/pages.py` (`PAGES_BY_ORG`) and view fixtures in `tests/fixtures/<org>/views/`, build with `VITE_DEFAULT_ORG=<org>`, run `python scripts/web_audit.py --org <org> --dist <dir> --mode a11y`, and add a job to `.github/workflows/web-audit.yml`. Baselines live in `tests/baseline-web/<org>/`; generate them in CI (see below).
5. List the dashboard on `sites/landing/public/index.html` once it is public.

A **health** tenant needs its own collector publishing views under `<org>/views/` on the `data` branch (no CSV, scoring or openedx pipeline required; with the Python pipeline a metric with `parse_rule: boolean` needs no code). The health web module is still openedx's own, so a second health tenant also needs a module registered in `web/src/tenants/registry.ts`.

### Fleet tenants (Moneta)

A fleet tenant tracks a company's forks of open source apps against their upstreams. It has no CSV and no scoring; everything comes from the public GitHub API with the default token. The code is shared by every fleet tenant (`collectors/fleet/`, `scripts/collect_fleet.py`); a tenant is config only. Moneta (`moneta`, the Pressingly forks) is the first; see [Adding a tenant](#adding-a-tenant) for a new one.

- `dashboard/config/_kinds/fleet/defaults.yaml` holds the defaults for every fleet tenant: branches, `fork_release_tag`, the status ladder (thresholds and badge colours), history length, freshness, pages, and one entry per signal with `collect` (fetch it) and `show` (the surfaces it appears on: `card`, `table`, `detail`, `attention`, `overview_tile`, `csv`, `filter`) plus its own settings.
- `dashboard/config/<org>/fleet.yaml` overrides only what differs; mappings merge key by key and lists replace. Moneta sets `foss-main`/`foss-sandbox`, its `fork_release_tag` (`^v2\d\.\d{1,2}\.\d+$`) and turns `promotion` on. The merged result is validated against `schemas/fleet.schema.json`, and `collectors/fleet/settings.py` fails the run if an enabled signal lacks what it needs (`promotion` needs `branches.staging`) or a tenant's own status rule uses a threshold of a signal it turned off. When a tenant keeps the default ladder, thresholds of its disabled signals are dropped instead.
- `apps.yaml` lists the tracked repos: `class` (`fork` or `original`, set by hand), upstream, branches, licence (`licence` is the plain licence name used for counting, `licence_note` carries caveats), and the optional `mcp_server`, `sso`, `e2e`, `runbook_url`, `purpose` and `what_we_changed`. A `FORK.md` on the production branch replaces `what_we_changed`. `updates.yaml` is the hand-written updates feed.
- Signals live in `collectors/fleet/signals/`, one module each, listed in order in `collectors/fleet/registry.py`. Each owns the record fields it returns; a field is absent when the tenant does not collect that signal and `null` when collecting it failed. `ForkContext` fetches what several signals share (comparison, tags, releases, base release) once per fork and only when a signal asks for it. `meta.json` carries `kind: fleet` and the manifest under `fleet`: `signals` lists every signal of the kind with `collect`, `show`, `tier`, `cadence`, the status `thresholds` it owns and its `settings`, and `statuses` is the full ladder with thresholds and colours. The `show` lists in the defaults match what the pages display today; the Signals panel work will gate each surface on them.
- `collect-fleet.yml` (daily) runs `scripts/collect_fleet.py --org <org>` (`api` tier) once per fleet org in `tenants.json`: `views/{meta,apps,drift,drift_history,updates}.json`, `badges/<repo>.json` (shields.io endpoint payloads) and `VERSIONS.md`, all under `<org>/` on the `data` branch. History is extended from the previous run's `drift_history.json`.
- `collect-fleet-weekly.yml` runs `scripts/collect_fleet.py --org <org> --tier clone` per fleet org: each enabled clone signal writes `views/<signal>.json`. Today that is `conflicts` (blob-less clones plus `git merge-tree` listing the files a sync with upstream would conflict on); the pages work without it.
- `fork_release_tag` (regex, per tenant or per app) picks which of our tags count as fork releases; `release_tag` (regex, optional, per app) picks one upstream release line when the upstream publishes several (Twenty: `^twenty/v...`) and replaces the any-version fallback for tag-only upstreams. `behind_release` and `ahead_release` count commits against the latest upstream release, beside the branch distance. An advisory's `affects_fork_release` compares its vulnerable version ranges with the upstream release our latest fork release is based on (`null` when that base cannot be found).
- "Latest release" means the newest stable tag cut from the production branch (a stable tag whose commit is not in upstream). "Maintainers" on an app are the people who merged its pull requests (all of them, paged) into the production branch of our fork (GraphQL `mergedBy`, bots skipped), never upstream maintainers. The collector cannot see production, so no page says "deployed".

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
