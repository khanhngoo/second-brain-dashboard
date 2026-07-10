"""Board reads: kanban (by status) and impact/effort (by impact x effort)."""

from __future__ import annotations

import sqlite3

from .serialize import rows_to_dicts
from .validation import require_pillar


def _filter(conn: sqlite3.Connection, pillar):
    if pillar is None:
        return "", []
    return "WHERE pillar_id = ?", [require_pillar(conn, pillar)["id"]]


def get_kanban(conn: sqlite3.Connection, pillar: int | str | None = None) -> dict:
    """Tasks grouped into To Do / Doing / Done in board order (archived excluded)."""
    clause, params = _filter(conn, pillar)
    extra = "status != 'archived'"
    where = f"{clause} AND {extra}" if clause else f"WHERE {extra}"
    rows = conn.execute(
        f"SELECT * FROM tasks {where} ORDER BY sort_order, id", params
    ).fetchall()
    cols = {"todo": [], "doing": [], "done": []}
    for r in rows:
        cols.setdefault(r["status"], []).append(dict(r))
    return cols


def get_impact_effort(conn: sqlite3.Connection, pillar: int | str | None = None) -> dict:
    """Tasks grouped into the four impact/effort quadrants (archived excluded).

    Done tasks are INCLUDED so the matrix can show them dimmed/struck until the
    user archives; each row carries `milestone_title` (LEFT JOIN) for the card.
    """
    clause, params = _filter(conn, pillar)
    # _filter's clause references `pillar_id`; qualify to the tasks table so the
    # milestones join stays unambiguous.
    clause = clause.replace("pillar_id", "t.pillar_id")
    extra = "t.status != 'archived'"
    where = f"{clause} AND {extra}" if clause else f"WHERE {extra}"
    rows = conn.execute(
        f"""
        SELECT t.*, m.title AS milestone_title,
               COALESCE(SUM(CASE WHEN s.voided = 0 THEN s.duration_min ELSE 0 END), 0)
                   AS actual_duration_min
        FROM tasks t
        LEFT JOIN milestones m ON m.id = t.milestone_id
        LEFT JOIN sessions s ON s.task_id = t.id
        {where}
        GROUP BY t.id
        ORDER BY t.sort_order, t.id
        """,
        params,
    ).fetchall()
    buckets = {
        "high_impact_low_effort": [],
        "high_impact_high_effort": [],
        "low_impact_low_effort": [],
        "low_impact_high_effort": [],
    }
    for r in rows:
        if r["is_impact"] and not r["is_effort"]:
            buckets["high_impact_low_effort"].append(dict(r))
        elif r["is_impact"] and r["is_effort"]:
            buckets["high_impact_high_effort"].append(dict(r))
        elif not r["is_impact"] and not r["is_effort"]:
            buckets["low_impact_low_effort"].append(dict(r))
        else:
            buckets["low_impact_high_effort"].append(dict(r))
    return buckets
