"""Time blocks: local CRUD, the auto-log sweep, confirm/skip.

P0 manages local time_blocks rows only — calendar push (docs/05) is P3.

Auto-log (docs/04): when wall-clock passes a planned block's end_at, the block
flips planned->done and auto-creates a reversible session. mark_block_skipped
soft-voids that session (voided=1) so skipped work never inflates pillar time.
"""

from __future__ import annotations

import sqlite3

from .. import clock
from ..errors import ValidationError
from .serialize import row_to_dict, rows_to_dicts
from .validation import require_block, require_task


def _block(conn: sqlite3.Connection, block_id: int) -> dict:
    return row_to_dict(conn.execute("SELECT * FROM time_blocks WHERE id = ?", (block_id,)).fetchone())


def _duration_min(start_at: str, end_at: str) -> int:
    start = clock.parse_iso(start_at)
    end = clock.parse_iso(end_at)
    return max(0, round((end - start).total_seconds() / 60))


def create_time_block(conn: sqlite3.Connection, task_id: int, start_at: str, end_at: str) -> dict:
    require_task(conn, task_id)
    if clock.parse_iso(end_at) <= clock.parse_iso(start_at):
        raise ValidationError("end_at must be after start_at")
    now = clock.now_utc_iso()
    with conn:
        cur = conn.execute(
            """
            INSERT INTO time_blocks
                (task_id, start_at, end_at, status, auto_logged, confirmed, created_at)
            VALUES (?, ?, ?, 'planned', 0, 0, ?)
            """,
            (task_id, start_at, end_at, now),
        )
    return _block(conn, cur.lastrowid)


def move_time_block(conn: sqlite3.Connection, id: int, start_at: str, end_at: str) -> dict:
    require_block(conn, id)
    if clock.parse_iso(end_at) <= clock.parse_iso(start_at):
        raise ValidationError("end_at must be after start_at")
    with conn:
        conn.execute(
            "UPDATE time_blocks SET start_at = ?, end_at = ? WHERE id = ?",
            (start_at, end_at, id),
        )
    return _block(conn, id)


def delete_time_block(conn: sqlite3.Connection, id: int) -> dict:
    """Hard-delete a block. Any auto-logged session keeps its minutes
    (sessions.block_id is SET NULL by the FK)."""
    block = _block(conn, id)
    if block is None:
        require_block(conn, id)  # raises NotFoundError
    with conn:
        conn.execute("DELETE FROM time_blocks WHERE id = ?", (id,))
    return {"deleted": True, "id": id}


def run_autolog_sweep(conn: sqlite3.Connection, now: str | None = None) -> dict:
    """Flip every past-due planned block to done + auto-create its session.

    Idempotent (auto_logged guard). Called lazily at the top of get_today_brief
    and exposed standalone for the CLI / a future scheduler.
    """
    now = now or clock.now_utc_iso()
    due = conn.execute(
        """
        SELECT * FROM time_blocks
        WHERE status = 'planned' AND auto_logged = 0 AND end_at <= ?
        """,
        (now,),
    ).fetchall()
    logged = 0
    with conn:
        for b in due:
            duration = _duration_min(b["start_at"], b["end_at"])
            conn.execute(
                """
                INSERT INTO sessions
                    (task_id, source, started_at, ended_at, duration_min, block_id,
                     voided, note, created_at)
                VALUES (?, 'block', ?, ?, ?, ?, 0, NULL, ?)
                """,
                (b["task_id"], b["start_at"], b["end_at"], duration, b["id"], now),
            )
            conn.execute(
                "UPDATE time_blocks SET status = 'done', auto_logged = 1 WHERE id = ?",
                (b["id"],),
            )
            logged += 1
    return {"swept": len(due), "sessions_created": logged}


def confirm_blocks(conn: sqlite3.Connection, date: str) -> dict:
    """Confirm auto-logged blocks for a given date (accept them as-is)."""
    with conn:
        cur = conn.execute(
            """
            UPDATE time_blocks
            SET confirmed = 1
            WHERE auto_logged = 1 AND date(end_at) = date(?)
            """,
            (date,),
        )
    return {"confirmed": cur.rowcount, "date": date}


def mark_block_skipped(conn: sqlite3.Connection, id: int) -> dict:
    """Set the block 'skipped' and soft-void its auto-created session."""
    require_block(conn, id)
    with conn:
        conn.execute(
            "UPDATE sessions SET voided = 1 WHERE block_id = ? AND source = 'block'",
            (id,),
        )
        conn.execute("UPDATE time_blocks SET status = 'skipped' WHERE id = ?", (id,))
    return _block(conn, id)


def list_blocks_on(conn: sqlite3.Connection, date: str) -> list[dict]:
    """All time blocks whose start_at falls on the given date (for the brief)."""
    return rows_to_dicts(
        conn.execute(
            "SELECT * FROM time_blocks WHERE date(start_at) = date(?) ORDER BY start_at",
            (date,),
        ).fetchall()
    )
