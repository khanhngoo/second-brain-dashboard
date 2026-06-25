"""Task reads + writes.

Two rules enforced here:
  * the pillar/milestone invariant (via resolve_task_pillar), on create AND
    whenever update touches pillar/milestone;
  * status is written ONLY by set_task_status — never by create_task/update_task
    (the session-vs-status split, docs/02 + docs/04).
"""

from __future__ import annotations

import sqlite3

from .. import clock
from ..errors import ValidationError
from .serialize import row_to_dict, rows_to_dicts
from .validation import (
    TASK_STATUSES,
    TIMER_MODES,
    check_enum,
    quadrant_to_flags,
    require_task,
    resolve_task_pillar,
)


def _get_raw(conn: sqlite3.Connection, task_id: int) -> dict:
    return row_to_dict(conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone())


def create_task(
    conn: sqlite3.Connection,
    *,
    pillar: int | str | None = None,
    title: str,
    milestone: int | None = None,
    description: str | None = None,
    is_urgent: bool = False,
    is_important: bool = False,
    estimated_duration_min: int | None = None,
    timer_mode: str | None = None,
    due_date: str | None = None,
    note_ref: str | None = None,
) -> dict:
    pillar_id = resolve_task_pillar(conn, pillar=pillar, milestone_id=milestone)
    if timer_mode is not None:
        check_enum(timer_mode, TIMER_MODES, "timer_mode")
    now = clock.now_utc_iso()
    nxt = conn.execute(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM tasks WHERE pillar_id = ?",
        (pillar_id,),
    ).fetchone()["n"]
    with conn:
        cur = conn.execute(
            """
            INSERT INTO tasks
                (pillar_id, milestone_id, title, description, status,
                 is_urgent, is_important, estimated_duration_min, timer_mode,
                 due_date, note_ref, sort_order, created_at)
            VALUES (?, ?, ?, ?, 'todo', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                pillar_id, milestone, title, description,
                int(bool(is_urgent)), int(bool(is_important)),
                estimated_duration_min, timer_mode, due_date, note_ref, nxt, now,
            ),
        )
    return _get_raw(conn, cur.lastrowid)


# Fields update_task may set. Note: status is deliberately excluded.
_UPDATABLE = {
    "title", "description", "milestone_id", "pillar_id",
    "is_urgent", "is_important", "estimated_duration_min",
    "timer_mode", "due_date", "note_ref", "sort_order",
}


def update_task(conn: sqlite3.Connection, id: int, **fields) -> dict:
    current = require_task(conn, id)

    if "status" in fields:
        raise ValidationError("use set_task_status to change task status")

    unknown = set(fields) - _UPDATABLE
    if unknown:
        raise ValidationError(f"cannot update task field(s): {', '.join(sorted(unknown))}")

    # Re-validate the invariant whenever pillar or milestone is touched. Only an
    # *explicitly passed* pillar is treated as a constraint; a milestone-only
    # move adopts the milestone's pillar (rather than conflicting with the old
    # one). If neither is explicit, fall back to the task's current pillar.
    if "pillar_id" in fields or "milestone_id" in fields:
        explicit_pillar = fields.get("pillar_id", None)
        new_milestone = fields.get("milestone_id", current["milestone_id"])
        if explicit_pillar is None and new_milestone is None:
            constraint_pillar = current["pillar_id"]
        else:
            constraint_pillar = explicit_pillar
        fields["pillar_id"] = resolve_task_pillar(
            conn, pillar=constraint_pillar, milestone_id=new_milestone
        )

    if "timer_mode" in fields and fields["timer_mode"] is not None:
        check_enum(fields["timer_mode"], TIMER_MODES, "timer_mode")

    sets, params = [], []
    for k, v in fields.items():
        if k in ("is_urgent", "is_important"):
            v = int(bool(v))
        sets.append(f"{k} = ?")
        params.append(v)
    if sets:
        params.append(id)
        with conn:
            conn.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?", params)
    return _get_raw(conn, id)


def set_task_status(conn: sqlite3.Connection, id: int, status: str) -> dict:
    """The ONLY path that writes tasks.status. Stamps completed_at on 'done'."""
    require_task(conn, id)
    check_enum(status, TASK_STATUSES, "status")
    completed_at = clock.now_utc_iso() if status == "done" else None
    with conn:
        conn.execute(
            "UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?",
            (status, completed_at, id),
        )
    return _get_raw(conn, id)


def list_tasks(
    conn: sqlite3.Connection,
    pillar: int | str | None = None,
    milestone: int | None = None,
    status: str | None = None,
    quadrant: str | None = None,
    due_before: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    from .validation import require_pillar

    where, params = [], []
    if pillar is not None:
        where.append("pillar_id = ?")
        params.append(require_pillar(conn, pillar)["id"])
    if milestone is not None:
        where.append("milestone_id = ?")
        params.append(milestone)
    if status is not None:
        where.append("status = ?")
        params.append(check_enum(status, TASK_STATUSES, "status"))
    if quadrant is not None:
        u, i = quadrant_to_flags(quadrant)
        where.append("is_urgent = ? AND is_important = ?")
        params += [u, i]
    if due_before is not None:
        where.append("due_date IS NOT NULL AND due_date < ?")
        params.append(due_before)
    clause = ("WHERE " + " AND ".join(where)) if where else ""
    sql = f"SELECT * FROM tasks {clause} ORDER BY sort_order, id"
    if limit is not None:
        sql += " LIMIT ?"
        params.append(limit)
    return rows_to_dicts(conn.execute(sql, params).fetchall())


def list_archived_tasks(
    conn: sqlite3.Connection,
    pillar: int | str | None = None,
    completed_from: str | None = None,
    completed_to: str | None = None,
) -> list[dict]:
    """Completed task archive with display metadata and logged duration."""
    from .validation import require_pillar

    where = ["t.status = 'done'"]
    params = []
    if pillar is not None:
        where.append("t.pillar_id = ?")
        params.append(require_pillar(conn, pillar)["id"])
    if completed_from is not None:
        where.append("t.completed_at IS NOT NULL AND t.completed_at >= ?")
        params.append(completed_from)
    if completed_to is not None:
        where.append("t.completed_at IS NOT NULL AND t.completed_at <= ?")
        params.append(completed_to)

    sql = f"""
        SELECT
            t.id,
            t.pillar_id,
            p.slug AS pillar_slug,
            p.name AS pillar_name,
            p.color AS pillar_color,
            t.milestone_id,
            m.title AS milestone_title,
            t.title,
            t.description,
            t.status,
            t.is_urgent,
            t.is_important,
            t.estimated_duration_min,
            COALESCE(SUM(CASE WHEN s.voided = 0 THEN s.duration_min ELSE 0 END), 0)
                AS actual_duration_min,
            t.due_date,
            t.note_ref,
            t.sort_order,
            t.created_at,
            t.completed_at
        FROM tasks t
        JOIN pillars p ON p.id = t.pillar_id
        LEFT JOIN milestones m ON m.id = t.milestone_id
        LEFT JOIN sessions s ON s.task_id = t.id
        WHERE {" AND ".join(where)}
        GROUP BY t.id
        ORDER BY t.completed_at DESC, t.id DESC
    """
    return rows_to_dicts(conn.execute(sql, params).fetchall())


def get_task(conn: sqlite3.Connection, id: int) -> dict:
    """Full task: subtasks, sessions total minutes, blocks, note_ref."""
    d = row_to_dict(require_task(conn, id))
    d["subtasks"] = rows_to_dicts(
        conn.execute(
            "SELECT * FROM subtasks WHERE task_id = ? ORDER BY sort_order, id", (id,)
        ).fetchall()
    )
    d["sessions_total_min"] = int(
        conn.execute(
            "SELECT COALESCE(SUM(duration_min), 0) FROM sessions WHERE task_id = ? AND voided = 0",
            (id,),
        ).fetchone()[0]
    )
    d["blocks"] = rows_to_dicts(
        conn.execute(
            "SELECT * FROM time_blocks WHERE task_id = ? ORDER BY start_at", (id,)
        ).fetchall()
    )
    return d
