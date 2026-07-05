"""Sessions (the time log).

log_session NEVER writes tasks.status — preserving the session-vs-status split
(docs/02 + docs/04). Time is recorded by logging a finished session with an
explicit duration (computed from start/end on the client).
"""

from __future__ import annotations

import sqlite3

from .. import clock
from ..errors import ValidationError
from .serialize import row_to_dict
from .validation import (
    SESSION_SOURCES,
    check_enum,
    require_task,
)


def log_session(
    conn: sqlite3.Connection,
    task_id: int,
    duration_min: int,
    source: str = "manual",
    started_at: str | None = None,
    ended_at: str | None = None,
    note: str | None = None,
    block_id: int | None = None,
) -> dict:
    """Record minutes against a task. Does NOT touch task status."""
    require_task(conn, task_id)
    check_enum(source, SESSION_SOURCES, "source")
    if duration_min is None or int(duration_min) < 0:
        raise ValidationError("duration_min must be a non-negative integer")
    now = clock.now_utc_iso()
    with conn:
        cur = conn.execute(
            """
            INSERT INTO sessions
                (task_id, source, started_at, ended_at, duration_min, block_id,
                 voided, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (task_id, source, started_at, ended_at, int(duration_min), block_id, note, now),
        )
    return row_to_dict(conn.execute("SELECT * FROM sessions WHERE id = ?", (cur.lastrowid,)).fetchone())


def replace_sessions(
    conn: sqlite3.Connection,
    task_id: int,
    duration_min: int,
    source: str = "manual",
    note: str | None = None,
) -> dict:
    """Set a task's total logged time to exactly duration_min.

    Voids every existing non-voided session for the task, then logs one new
    session for duration_min (skipped if 0 — the task ends up with nothing
    logged). Unlike log_session, this REPLACES the running total rather than
    adding to it — for the "set duration" UI flow, not auto-logging.
    """
    require_task(conn, task_id)
    check_enum(source, SESSION_SOURCES, "source")
    if duration_min is None or int(duration_min) < 0:
        raise ValidationError("duration_min must be a non-negative integer")
    now = clock.now_utc_iso()
    with conn:
        conn.execute(
            "UPDATE sessions SET voided = 1 WHERE task_id = ? AND voided = 0",
            (task_id,),
        )
        if int(duration_min) > 0:
            conn.execute(
                """
                INSERT INTO sessions
                    (task_id, source, started_at, ended_at, duration_min, block_id,
                     voided, note, created_at)
                VALUES (?, ?, NULL, NULL, ?, NULL, 0, ?, ?)
                """,
                (task_id, source, int(duration_min), note, now),
            )
    total = conn.execute(
        "SELECT COALESCE(SUM(duration_min), 0) FROM sessions WHERE task_id = ? AND voided = 0",
        (task_id,),
    ).fetchone()[0]
    return {"task_id": task_id, "sessions_total_min": int(total)}
