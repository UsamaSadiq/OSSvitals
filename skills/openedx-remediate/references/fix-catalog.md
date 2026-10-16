# Fix catalog

One entry per supported check. Each entry has preconditions (when to refuse), the fix, and the
validator. `scripts/precheck.py` encodes the preconditions and `scripts/validate.py` the validator,
so read this file for the judgement behind them, not as a second source of truth for the rules.

A refusal is a successful outcome. Report it with the facts precheck printed; never force a fix
through a precondition. Dashboard data can lag the repo by weeks, so the clone always wins.

## exists..editorconfig

Fix: copy the edx-lint generated `.editorconfig` that `openedx/.github` ships, unchanged, hash
comment included. Pinned to commit `8180ce263b65ddc227f2be762a6c2d0d9459a464` (last change to the
file, 2022-09-10):

```bash
gh api "repos/openedx/.github/contents/.editorconfig?ref=8180ce263b65ddc227f2be762a6c2d0d9459a464" \
  -H 'Accept: application/vnd.github.raw' > .editorconfig
```

Why unchanged: edx-lint verifies the trailing hash, so a hand-edited copy fails `edx_lint check`.
Repo-specific tweaks belong in `.editorconfig_tweaks`, which maintainers own.

Refuse when the file exists.

## makefile.test-python and makefile.quality-python

Fix: add the target as an alias of the existing `test` (or `tests`) or `quality` (or `lint`)
target, and list it in `.PHONY`. Append near the source target:

```make
test-python: test ## Alias kept for the Open edX repo health checks
```

Why an alias: the check only greps for `^test-python:`; it is the Open edX convention from
edx-cookiecutters, and an alias changes nothing for existing callers. Do not invent a new test
command.

Refuse when there is no Makefile, when the target exists, or when there is no source target to
alias.

The validator runs `make -n <target>`, which evaluates parse-time `$(shell ...)` expansions even in
dry-run mode, so only run it on repos you would run `make` in anyway.

## dependabot.exists

Fix: add `.github/dependabot.yml`, version 2, weekly, with only the ecosystems the repo actually
needs:

- `github-actions` always (this is what `openedx/.github` itself does).
- `npm` only when `package.json` exists.
- `pip` only when a Python manifest exists and no scheduled upgrade workflow does. Open edX repos
  pin with pip-tools and refresh through `upgrade-python-requirements.yml`, so Dependabot pip PRs
  would fight that job.

Refuse when `dependabot.yml` exists, or when Renovate is configured (`renovate.json` and
variants). Renovate already covers dependency freshness; the dashboard's `renovate.configured`
check is the one that credits it.

## exists.openedx.yaml

Fix: add a minimal OEP-2 file:

```yaml
# This file describes this Open edX repo, as described in OEP-2:
# https://open-edx-proposals.readthedocs.io/en/latest/oep-0002-bp-repo-metadata.html#specification

oeps:
    oep-2: true

tags:
    - <one of: library, backend-tooling, frontend, xblock, service>
```

Pick the tag from what the repo is; do not guess `owner` or `maintainers`, the dashboard's
ownership data comes from catalog-info.yaml and the GitHub teams, not from this file.

Refuse when `openedx.yaml` exists, or when `catalog-info.yaml` exists: the community is replacing
openedx.yaml with catalog-info.yaml (openedx/public-engineering#410), and the dashboard's own
scoring config records this as a known limitation. The right fix there is to the scoring rule.

## tox_ini.uses_whitelist_externals

Fix: rename `whitelist_externals` to `allowlist_externals` in `tox.ini` (the old name is deprecated
since tox 3.18). Nothing else changes.

Refuse when `tox.ini` is missing, or when the key is already `allowlist_externals`. In the second
case the dashboard is showing a false positive: the raw health value `false` means "does not use
the deprecated key", and `classify()` in `dashboard/lib/checks.py` reads every `false` as a failure.
Report it as a dashboard bug (this column needs an inverted-boolean rule in `checks.py`), not a repo
defect. The inversion also means a repo that still uses the deprecated key is shown as passing, so
this check never appears in `failing_checks`: the fix branch is reachable only when the user names
the check explicitly.

## Not supported, on purpose

- `exists.CHANGELOG.rst`, `exists..pii_annotations.yml`, `readme.*`: the file needs real content
  only maintainers can write. An empty placeholder would pass the check and help nobody.
- `docs.build_badge`, `readthedocs_config.exists`: requires a Read the Docs project to exist.
- `setup_py.py312_classifiers`, `exists.setup.py`, `exists.setup.cfg`: packaging decisions, and
  services without a setup.py are not wrong.
- `dependabot.has_ecosystem.*`, `dependencies.*.count`, `django_packages.*`: measurements, not
  defects.
- `github_actions`: not surfaced as a check column (no dot in the name), so it never appears in
  `failing_checks`.
