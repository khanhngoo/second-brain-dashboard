"""Subtask writes."""

from __future__ import annotations

import sqlite3

from .. import clock
from .serialize import row_to_dict
from .validation import require_subtask, require_task


def add_subtask(conn: sqlite3.Connection, task_id: int, title: str) -> dict:
    require_task(conn, task_id)
    now = clock.now_utc_iso()
    nxt = conn.execute(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM subtasks WHERE task_id = ?",
        (task_id,),
    ).fetchone()["n"]
    with conn:
        cur = conn.execute(
            """
            INSERT INTO subtasks (task_id, title, done, sort_order, created_at)
            VALUES (?, ?, 0, ?, ?)
            """,
            (task_id, title, nxt, now),
        )
    row = conn.execute("SELECT * FROM subtasks WHERE id = ?", (cur.lastrowid,)).fetchone()
    return row_to_dict(row)


def toggle_subtask(conn: sqlite3.Connection, id: int) -> dict:
    row = require_subtask(conn, id)
    new_done = 0 if row["done"] else 1
    completed_at = clock.now_utc_iso() if new_done else None
    with conn:
        conn.execute(
            "UPDATE subtasks SET done = ?, completed_at = ? WHERE id = ?",
            (new_done, completed_at, id),
        )
    out = conn.execute("SELECT * FROM subtasks WHERE id = ?", (id,)).fetchone()
    return row_to_dict(out)
