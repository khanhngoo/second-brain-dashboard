"""External calendar events (read-only mirror) — core reads + P3 upsert.

The dashboard never owns or edits these; they are commitments to plan around.
"""

from __future__ import annotations

import sqlite3

from .. import clock
from .serialize import rows_to_dicts


def list_external_events(conn: sqlite3.Connection, start: str, end: str) -> list[dict]:
    """External events overlapping [start, end): start_at < end AND end_at > start."""
    return rows_to_dicts(
        conn.execute(
            """
            SELECT * FROM external_events
            WHERE start_at < ? AND end_at > ?
            ORDER BY start_at
            """,
            (end, start),
        ).fetchall()
    )


def upsert_external_events(conn: sqlite3.Connection, events: list[dict]) -> dict:
    """Insert or update external events keyed on (provider, external_id).

    Used by the P3 read-sync. Each event dict needs: provider, external_id,
    title, start_at, end_at. Idempotent — re-syncing updates, never duplicates.
    """
    now = clock.now_utc_iso()
    inserted = updated = 0
    with conn:
        for e in events:
            existing = conn.execute(
                "SELECT id FROM external_events WHERE provider = ? AND external_id = ?",
                (e["provider"], e["external_id"]),
            ).fetchone()
            if existing is None:
                conn.execute(
                    """
                    INSERT INTO external_events
                        (provider, external_id, title, start_at, end_at, last_synced)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (e["provider"], e["external_id"], e.get("title"),
                     e["start_at"], e["end_at"], now),
                )
                inserted += 1
            else:
                conn.execute(
                    """
                    UPDATE external_events
                    SET title = ?, start_at = ?, end_at = ?, last_synced = ?
                    WHERE id = ?
                    """,
                    (e.get("title"), e["start_at"], e["end_at"], now, existing["id"]),
                )
                updated += 1
    return {"inserted": inserted, "updated": updated}
