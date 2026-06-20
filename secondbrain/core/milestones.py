"""Milestone reads + writes. Progress is always derived from v_milestone_progress."""

from __future__ import annotations

import sqlite3

from .. import clock
from ..errors import ValidationError
from .serialize import row_to_dict, rows_to_dicts
from .validation import (
    MILESTONE_STATUSES,
    check_enum,
    require_milestone,
    require_pillar,
)


def _milestone_with_progress(conn: sqlite3.Connection, milestone_id: int) -> dict:
    row = conn.execute(
        """
        SELECT m.*, vp.total_tasks, vp.done_tasks, vp.progress
        FROM milestones m
        LEFT JOIN v_milestone_progress vp ON vp.milestone_id = m.id
        WHERE m.id = ?
        """,
        (milestone_id,),
    ).fetchone()
    return row_to_dict(row)


def list_milestones(
    conn: sqlite3.Connection,
    pillar: int | str | None = None,
    status: str | None = None,
) -> list[dict]:
    where = []
    params: list = []
    if pillar is not None:
        where.append("m.pillar_id = ?")
        params.append(require_pillar(conn, pillar)["id"])
    if status is not None:
        where.append("m.status = ?")
        params.append(check_enum(status, MILESTONE_STATUSES, "status"))
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    rows = conn.execute(
        f"""
        SELECT m.*, vp.total_tasks, vp.done_tasks, vp.progress
        FROM milestones m
        LEFT JOIN v_milestone_progress vp ON vp.milestone_id = m.id
        {clause}
        ORDER BY m.pillar_id, m.sort_order, m.id
        """,
        params,
    ).fetchall()
    return rows_to_dicts(rows)


def create_milestone(
    conn: sqlite3.Connection,
    *,
    pillar: int | str,
    title: str,
    description: str | None = None,
    target_date: str | None = None,
) -> dict:
    pillar_id = require_pillar(conn, pillar)["id"]
    now = clock.now_utc_iso()
    with conn:
        cur = conn.execute(
            """
            INSERT INTO milestones
                (pillar_id, title, description, status, target_date, sort_order, created_at)
            VALUES (?, ?, ?, 'active', ?, 0, ?)
            """,
            (pillar_id, title, description, target_date, now),
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
