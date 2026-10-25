# Contributing to OSSvitals

This project is licensed under AGPL-3.0-or-later. Contributions are accepted under the same license (inbound = outbound).

OSSvitals is multi-tenant: each GitHub organization it grades has its own config folder under `dashboard/config/<org>/`, its own collector and its own pages. Changes to shared code must keep every tenant working; changes to one tenant's config or pages should stay inside that tenant's folders. To add a new organization, follow [Adding a tenant](docs/RUNBOOK.md#adding-a-tenant).

## Sign-off (DCO)
Every commit must carry a [Developer Certificate of Origin](https://developercertificate.org/) sign-off, certifying that you have the right to submit it under the project's license. Add it with `git commit -s`, which appends:

```
Signed-off-by: Your Name <your.email@example.com>
```

## Getting Started
1. Fork this repository
2. Create a new branch for your changes
3. Make your changes, keeping config validation and feature flags intact
4. Open a PR with detailed description
5. Sign off every commit (`git commit -s`)
6. Fix any test or lint failures

## Testing
1. Run `flake8 .` for linter checks
2. Run `mypy .` for typechecker
3. Run `python -m pytest -q tests`, and for UI changes `scripts/web_audit_container.sh --mode diff` (see docs/RUNBOOK.md)

