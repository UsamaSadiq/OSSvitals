# Branch, commit and PR format

## Branch

`ossvitals/<check-slug>` where the slug is the check name with every character outside
`[a-z0-9]` replaced by `-` and runs collapsed: `exists..editorconfig` becomes
`ossvitals/exists-editorconfig`, `makefile.test-python` becomes `ossvitals/makefile-test-python`.
Cut it from the fork's synced default branch. Never reuse a branch across checks.

## Commit

One commit, conventional subject, imperative, lowercase, no trailing period:

| check | subject |
|---|---|
| exists..editorconfig | `chore: add the edx-lint editorconfig` |
| makefile.test-python | `build: add test-python make target` |
| makefile.quality-python | `build: add quality-python make target` |
| dependabot.exists | `ci: add dependabot config for <ecosystems>` |
| exists.openedx.yaml | `chore: add openedx.yaml metadata` |
| tox_ini.uses_whitelist_externals | `build: rename whitelist_externals to allowlist_externals` |

Body: one line naming the check, for example `Fixes the OSSvitals health check exists..editorconfig.`
Add `Co-authored-by: Claude <claude@anthropic.com>` only when the user passed `--coauthor`.

## Pull request

Draft. Title is the commit subject. Target depends on the flag:

| mode | `--repo` | `--base` | `--head` |
|---|---|---|---|
| default | `<owner>/<repo>` | fork default branch | `<branch>` |
| `--upstream` | `openedx/<repo>` | upstream default branch | `<owner>:<branch>` |

`--upstream` needs the user's explicit confirmation after seeing the rendered body. The body is the
same in both modes; upstream maintainers see the disclosure and the marker lines too.

Body template. Fill every placeholder; delete nothing except the optional line marked so.

```markdown
## Description

- Fixes the OSSvitals health check `<check>` (<check title>), which <pass_pct>% of Open edX
  repositories pass. <one sentence on what the check measures and why it matters>
- <one bullet per file changed: what and why, in the repo's own terms>
- Scope is this one check so it can be reviewed and merged on its own.

## Evidence

- Precheck on the clone at `<short sha>`: <precheck reason>
- Validation: <each validate.py evidence line>
- Dashboard: <repo> scores <score_composite> (<score_letter>) at <dashboard repo url>

## AI disclosure

This change was prepared with Anthropic Claude through the OSSvitals `openedx-remediate` skill,
as permitted by the [Open edX AI contribution policy](https://github.com/openedx/.github/blob/master/AI_POLICY.md).
The fix comes from a fixed catalog and was validated by script. It is opened as a draft; the
submitter reviews the diff and this description before marking it ready for review.

OSSvitals-Check: <check>
OSSvitals-Repo: <org/repo>
```

The two trailing `OSSvitals-*` lines are the machine-readable marker: the dashboard collector finds
fork PRs by them and shows the PR against the failing check. Keep them as the last lines, exact
key names, one space after the colon, check name verbatim (the double dot in `exists..editorconfig`
is part of the key).

The dashboard repo URL is `https://openedx.ossvitals.org/repo_detail?repo=<org>%2F<repo>`
(`web/src/components/repoDetailPath.ts` builds it).
