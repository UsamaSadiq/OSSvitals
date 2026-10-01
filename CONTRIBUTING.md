# Contributing to Open edX Repository Health Dashboard

This project is licensed under AGPL-3.0-or-later. Contributions are accepted under the same license (inbound = outbound).

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
3. Check all visualizations in Streamlit app

