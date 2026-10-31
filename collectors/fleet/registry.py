"""Every fleet signal, in the order its fields appear in a fork record."""
from __future__ import annotations

from collectors.fleet.signals import Signal
from collectors.fleet.signals import (
    advisories,
    ci,
    conflicts,
    fork_release,
    licence_watch,
    maintainers,
    promotion,
    pull_requests,
    release_gap,
    upstream_activity,
    upstream_release,
)

SIGNALS: tuple[Signal, ...] = tuple(
    module.SIGNAL
    for module in (
        fork_release,
        upstream_release,
        release_gap,
        advisories,
        promotion,
        ci,
        pull_requests,
        maintainers,
        upstream_activity,
        licence_watch,
        conflicts,
    )
)
BY_KEY = {signal.key: signal for signal in SIGNALS}
