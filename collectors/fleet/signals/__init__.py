"""Optional parts of a fork record. Each signal owns the record fields it returns, in that order."""
from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable, Literal, TypeVar

if TYPE_CHECKING:
    from collectors.fleet.context import ForkContext

T = TypeVar("T")

API = "api"
CLONE = "clone"


@dataclass(frozen=True)
class Signal:
    """``api`` signals add fields to the daily fork record; ``clone`` signals write their own ``views/<key>.json``."""

    key: str
    collect: Callable[[ForkContext], dict[str, Any]]
    tier: Literal["api", "clone"] = API
    cadence: Literal["daily", "weekly"] = "daily"
    needs: tuple[str, ...] = ()
    thresholds: tuple[str, ...] = ()
    requires: tuple[str, ...] = ()


def guarded(collect: Callable[[], T]) -> T | None:
    """An optional signal that fails must not take the whole fork record down with it."""
    try:
        return collect()
    except (RuntimeError, KeyError, ValueError, TypeError):
        return None
