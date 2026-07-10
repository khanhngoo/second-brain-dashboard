"""Milestone reads + writes. Progress is always derived from v_milestone_progress.

Milestones are pillar-agnostic — a milestone's tasks may each belong to a
different pillar.
"""

from __future__ import annotations

import sqlite3

from .. import clock
from ..errors import ValidationError
from .serialize import row_to_dict, rows_to_dicts
from .validation import (
    MILESTONE_STATUSES,
    check_enum,
    require_milestone,
)

# Sum of non-voided session minutes across every task under a milestone.
_TIME_JOIN = """
    LEFT JOIN (
        SELECT t.milestone_id, SUM(s.duration_min) AS total_minutes
        FROM tasks t
        JOIN sessions s ON s.task_id = t.id AND s.voided = 0
        GROUP BY t.milestone_id
    ) mt ON mt.milestone_id = m.id
"""


def _milestone_with_progress(conn: sqlite3.Connection, milestone_id: int) -> dict:
    row = conn.execute(
        f"""
        SELECT m.*, vp.total_tasks, vp.done_tasks, vp.progress,
               COALESCE(mt.total_minutes, 0) AS total_minutes
        FROM milestones m
        LEFT JOIN v_milestone_progress vp ON vp.milestone_id = m.id
        {_TIME_JOIN}
        WHERE m.id = ?
        """,
        (milestone_id,),
    ).fetchone()
    return row_to_dict(row)


def list_milestones(
    conn: sqlite3.Connection,
    status: str | None = None,
) -> list[dict]:
    where = []
    params: list = []
    if status is not None:
        where.append("m.status = ?")
        params.append(check_enum(status, MILESTONE_STATUSES, "status"))
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    rows = conn.execute(
        f"""
        SELECT m.*, vp.total_tasks, vp.done_tasks, vp.progress,
               COALESCE(mt.total_minutes, 0) AS total_minutes
        FROM milestones m
        LEFT JOIN v_milestone_progress vp ON vp.milestone_id = m.id
        {_TIME_JOIN}
        {clause}
        ORDER BY m.sort_order, m.id
        """,
        params,
    ).fetchall()
    return rows_to_dicts(rows)


def create_milestone(
    conn: sqlite3.Connection,
    *,
    title: str,
    description: str | None = None,
    target_date: str | None = None,
) -> dict:
    now = clock.now_utc_iso()
    with conn:
        cur = conn.execute(
            """
            INSERT INTO milestones
                (title, description, status, target_date, sort_order, created_at)
            VALUES (?, ?, 'active', ?, 0, ?)
            """,
            (title, description, target_date, now),
        )
    return _milestone_with_progress(conn, cur.lastrowid)


def update_milestone(conn: sqlite3.Connection, id: int, **fields) -> dict:
    require_milestone(conn, id)
    allowed = {"title", "description", "status", "target_date", "sort_order"}
    sets, params = [], []
    for k, v in fields.items():
        if k not in allowed:
            raise ValidationError(f"cannot update milestone field: {k}")
        if k == "status":
            check_enum(v, MILESTONE_STATUSES, "status")
        sets.append(f"{k} = ?")
        params.append(v)
    if fields.get("status") == "done":
        sets.append("completed_at = ?")
        params.append(clock.now_utc_iso())
    if sets:
        params.append(id)
        with conn:
            conn.execute(
                f"UPDATE milestones SET {', '.join(sets)} WHERE id = ?", params
            )
    return _milestone_with_progress(conn, id)


def delete_milestone(conn: sqlite3.Connection, id: int) -> None:
    """Hard-delete a milestone. Its tasks are kept (milestone_id is SET NULL
    by the FK) — deleting a milestone never deletes tasks."""
    require_milestone(conn, id)
    with conn:
        conn.execute("DELETE FROM milestones WHERE id = ?", (id,))
