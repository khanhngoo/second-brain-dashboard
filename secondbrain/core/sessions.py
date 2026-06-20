"""Sessions (the time log) and server-managed timers.

log_session and start_timer NEVER write tasks.status. stop_timer(mark_done=True)
changes status only by calling set_task_status as a separate write — preserving
the session-vs-status split (docs/02 + docs/04).
"""

from __future__ import annotations

import sqlite3

from .. import clock
from ..errors import NotFoundError, ValidationError
from .serialize import row_to_dict
from .tasks import set_task_status
from .validation import (
    SESSION_SOURCES,
    TIMER_MODES,
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


def start_timer(conn: sqlite3.Connection, task_id: int, mode: str | None = None) -> dict:
    """Start (or restart) the server-managed timer for a task.

    Records only the start instant; the countdown is a UI concern (docs/04).
    Mode defaults to the task's timer_mode, then to 'manual'.
    """
    task = require_task(conn, task_id)
    if mode is None:
        mode = task["timer_mode"] or "manual"
    check_enum(mode, TIMER_MODES, "mode")
    now = clock.now_utc_iso()
    with conn:
        conn.execute(
            """
            INSERT INTO timers (task_id, mode, started_at, est_min)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(task_id) DO UPDATE SET
                mode = excluded.mode,
                started_at = excluded.started_at,
                est_min = excluded.est_min
            """,
            (task_id, mode, now, task["estimated_duration_min"]),
        )
    return row_to_dict(conn.execute("SELECT * FROM timers WHERE task_id = ?", (task_id,)).fetchone())


def stop_timer(conn: sqlite3.Connection, task_id: int, mark_done: bool = False) -> dict:
    """Stop the timer: log the elapsed session; optionally mark the task done.

    Returns {session, status_changed, task}. The session and the status change
    are two separate writes.
    """
    timer = conn.execute("SELECT * FROM timers WHERE task_id = ?", (task_id,)).fetchone()
    if timer is None:
        raise NotFoundError(f"no active timer for task {task_id}")

    started = clock.parse_iso(timer["started_at"])
    ended = clock.now_utc()
    duration_min = max(0, round((ended - started).total_seconds() / 60))
    source = "pomodoro" if timer["mode"] == "pomodoro" else "manual"

    with conn:
        conn.execute("DELETE FROM timers WHERE task_id = ?", (task_id,))
    session = log_session(
        conn,
        task_id,
        duration_min,
        source=source,
        started_at=timer["started_at"],
        ended_at=ended.isoformat(),
    )

    status_changed = False
    task = None
    if mark_done:
        task = set_task_status(conn, task_id, "done")
        status_changed = True
    else:
        task = row_to_dict(conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone())

    return {"session": session, "status_changed": status_changed, "task": task}
