"""Core wrappers for calendar status / sync / outbox flush.

Thin glue between the HTTP+CLI front doors and the calendar/ egress module. The
DB writes go through core/events + core/calendar_accounts; calendar/ never
touches the DB.
"""

from __future__ import annotations

import json
import sqlite3

from .calendar_accounts import list_calendar_accounts, touch_last_sync


def calendar_status(conn: sqlite3.Connection) -> dict:
    """Whether a provider is connected + the known accounts."""
    from ..calendar import provider_enabled

    accounts = [
        {"provider": a["provider"], "account_email": a["account_email"], "last_sync": a["last_sync"]}
        for a in list_calendar_accounts(conn)
    ]
    return {"enabled": provider_enabled(), "accounts": accounts}


def flush_calendar_outbox(conn: sqlite3.Connection, *, provider=None) -> dict:
    """Drain queued pushes that previously failed. No-op if nothing to flush."""
    from ..calendar import get_provider, provider_enabled

    p = provider if provider is not None else (get_provider() if provider_enabled() else None)
    if p is None:
        return {"flushed": 0, "remaining": _outbox_count(conn)}

    rows = conn.execute("SELECT * FROM calendar_outbox ORDER BY id").fetchall()
    flushed = 0
    for row in rows:
        payload = json.loads(row["payload"])
        try:
            if row["op"] == "create":
                from ..calendar.base import OWNED_TITLE_PREFIX
                event_id = p.push_event(
                    title=OWNED_TITLE_PREFIX + payload.get("title", ""),
                    start_at=payload["start_at"],
                    end_at=payload["end_at"],
                )
                if row["block_id"] is not None:
                    with conn:
                        conn.execute(
                            "UPDATE time_blocks SET calendar_provider='google', calendar_event_id=? WHERE id=?",
                            (event_id, row["block_id"]),
                        )
            elif row["op"] == "update":
                p.update_event(payload["calendar_event_id"],
                               start_at=payload["start_at"], end_at=payload["end_at"])
            elif row["op"] == "delete":
                p.delete_event(payload["calendar_event_id"])
            with conn:
                conn.execute("DELETE FROM calendar_outbox WHERE id = ?", (row["id"],))
            flushed += 1
        except Exception:
            with conn:
                conn.execute(
                    "UPDATE calendar_outbox SET attempts = attempts + 1 WHERE id = ?",
                    (row["id"],),
                )
    return {"flushed": flushed, "remaining": _outbox_count(conn)}


def run_calendar_sync(conn: sqlite3.Connection, start: str, end: str) -> dict:
    """Flush queued pushes, then pull external events into the DB."""
    from ..calendar.sync import sync_external_events
    from ..calendar import provider_enabled

    flush = flush_calendar_outbox(conn)
    read = sync_external_events(conn, start=start, end=end)
    if provider_enabled():
        touch_last_sync(conn, "google")
    return {"flush": flush, "read": read}


def _outbox_count(conn: sqlite3.Connection) -> int:
    return conn.execute("SELECT COUNT(*) FROM calendar_outbox").fetchone()[0]
