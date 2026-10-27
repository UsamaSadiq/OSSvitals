# CLAUDE.md — ossvitals

OSSvitals is multi-tenant; each org under `dashboard/config/<org>/` has its own collector and pages (see `docs/RUNBOOK.md`). The `openedx` tenant's data is fetched live from `openedx/wg-maintenance` (no secrets needed for read-only local dev).
