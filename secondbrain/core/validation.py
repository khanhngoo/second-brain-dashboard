"""Shared validation — the one place invariants and guards live.

Adapters never re-check anything here. The pillar/milestone invariant
(docs/02:68) lives in ``resolve_task_pillar`` and is the single source of truth
for that rule.
"""

from __future__ import annotations

import sqlite3

from ..errors import NotFoundError, ValidationError

# Enum vocabularies (docs/02, docs/03).
TASK_STATUSES = ("todo", "doing", "done", "archived")
MILESTONE_STATUSES = ("active", "done", "archived")
SESSION_SOURCES = ("block", "pomodoro", "manual", "adhd")
TIMER_MODES = ("pomodoro", "manual", "adhd")
BLOCK_STATUSES = ("planned", "done", "skipped")
QUADRANTS = ("urgent_important", "not_urgent_important",
             "urgent_not_important", "not_urgent_not_important")


def check_enum(value: str, allowed: tuple[str, ...], field: str) -> str:
    if value not in allowed:
        raise ValidationError(
            f"{field} must be one of {', '.join(allowed)}; got {value!r}"
        )
    return value


def require_pillar(conn: sqlite3.Connection, pillar: int | str) -> sqlite3.Row:
    """Resolve a pillar by id or slug. Raise NotFoundError if absent."""
    if isinstance(pillar, int) or (isinstance(pillar, str) and pillar.isdigit()):
        row = conn.execute(
            "SELECT * FROM pillars WHERE id = ?", (int(pillar),)
        ).fetchone()
    else:
        row = conn.execute(
            "SELECT * FROM pillars WHERE slug = ?", (pillar,)
        ).fetchone()
    if row is None:
        raise NotFoundError(f"pillar not found: {pillar!r}")
    return row


def require_milestone(conn: sqlite3.Connection, milestone_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM milestones WHERE id = ?", (milestone_id,)
    ).fetchone()
    if row is None:
        raise NotFoundError(f"milestone not found: {milestone_id}")
    return row


def require_task(conn: sqlite3.Connection, task_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM tasks WHERE id = ?", (task_id,)
    ).fetchone()
    if row is None:
        raise NotFoundError(f"task not found: {task_id}")
    return row


def require_subtask(conn: sqlite3.Connection, subtask_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM subtasks WHERE id = ?", (subtask_id,)
    ).fetchone()
    if row is None:
        raise NotFoundError(f"subtask not found: {subtask_id}")
    return row


def require_block(conn: sqlite3.Connection, block_id: int) -> sqlite3.Row:
    row = conn.execute(
        "SELECT * FROM time_blocks WHERE id = ?", (block_id,)
    ).fetchone()
    if row is None:
        raise NotFoundError(f"time block not found: {block_id}")
    return row


def resolve_task_pillar(
    conn: sqlite3.Connection,
    *,
    pillar: int | str | None,
    milestone_id: int | None,
) -> int:
    """Return the pillar_id a task must have, enforcing the invariant.

    docs/02:68 — if ``milestone_id`` is set, the task's pillar MUST equal the
    milestone's pillar. If both are given and conflict, raise ValidationError.
    If neither is given, raise (a task always needs a pillar).
    """
    if milestone_id is not None:
        m = require_milestone(conn, milestone_id)
        if pillar is not None:
            p = require_pillar(conn, pillar)
            if p["id"] != m["pillar_id"]:
                raise ValidationError(
                    "pillar/milestone mismatch: task pillar "
                    f"{p['id']} != milestone {milestone_id}'s pillar {m['pillar_id']}"
                )
        return m["pillar_id"]
    if pillar is None:
        raise ValidationError("a task requires a pillar (or a milestone)")
    return require_pillar(conn, pillar)["id"]


def quadrant_to_flags(quadrant: str) -> tuple[int, int]:
    """Decode an Eisenhower quadrant into (is_urgent, is_important)."""
    check_enum(quadrant, QUADRANTS, "quadrant")
    return {
        "urgent_important": (1, 1),
        "not_urgent_important": (0, 1),
        "urgent_not_important": (1, 0),
        "not_urgent_not_important": (0, 0),
    }[quadrant]
