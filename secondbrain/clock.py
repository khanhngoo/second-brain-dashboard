"""Single time source.

All timestamps are stored as UTC ISO-8601 TEXT (see docs/02). Every part of
the system reads the wall clock through ``now_utc`` / ``now_utc_iso`` so tests
can freeze time by monkeypatching this module.
"""

from __future__ import annotations

from datetime import datetime, timezone


def now_utc() -> datetime:
    """Current instant as a timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)


def now_utc_iso() -> str:
    """Current instant as a UTC ISO-8601 string, e.g. ``2026-06-20T13:45:00+00:00``."""
    return now_utc().isoformat()


def parse_iso(value: str) -> datetime:
    """Parse a stored ISO-8601 string back into an aware UTC datetime.

    Accepts a trailing ``Z`` and naive strings (assumed UTC) for robustness.
    """
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
