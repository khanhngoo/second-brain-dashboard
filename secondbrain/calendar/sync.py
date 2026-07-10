"""Read-sync: pull external events into the DB (via core), with the echo-loop
guard. The provider already excludes owned-tagged events; we additionally skip
any id that matches one of our pushed blocks (belt-and-suspenders, docs/05).
"""

from __future__ import annotations

import sqlite3

from . import get_provider, provider_enabled


def sync_external_events(conn: sqlite3.Connection, *, start: str, end: str) -> dict:
    """Fetch external events and upsert them. No-op if no provider connected."""
    if not provider_enabled():
        return {"synced": False, "inserted": 0, "updated": 0}

    from ..core.events import upsert_external_events

    events = get_provider().list_events(start=start, end=end)

    # Second echo-loop guard: drop any event whose id matches a block we pushed.
    owned_ids = {
        r["calendar_event_id"]
        for r in conn.execute(
            "SELECT calendar_event_id FROM time_blocks WHERE calendar_event_id IS NOT NULL"
        ).fetchall()
    }
    events = [e for e in events if e["external_id"] not in owned_ids]

    result = upsert_external_events(conn, events)
    return {"synced": True, **result}
