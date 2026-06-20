"""Pillar reads + rollups.

Pillars are read-only in P0 (seeded once, never created/deleted via tools).
"""

from __future__ import annotations

import sqlite3

from .serialize import row_to_dict, rows_to_dicts
from .validation import require_pillar


def _week_start_iso(conn: sqlite3.Connection) -> str:
    """Monday 00:00 of the current week, as a date string for >= comparison.

    Uses SQLite date math so it matches the stored ISO date prefixes.
    """
    # weekday('now'): 0=Sun..6=Sat in strftime('%w'); shift so Monday is start.
    row = conn.execute(
        "SELECT date('now', 'weekday 0', '-6 days') AS monday"
    ).fetchone()
    return row["monday"]


def _minutes_this_week(conn: sqlite3.Connection, pillar_id: int) -> int:
    monday = _week_start_iso(conn)
    row = conn.execute(
        """
        SELECT COALESCE(SUM(minutes), 0) AS m
        FROM v_pillar_time
        WHERE pillar_id = ? AND day >= ?
        """,
        (pillar_id, monday),
    ).fetchone()
    return int(row["m"])


def get_pillars(conn: sqlite3.Connection) -> list[dict]:
    """All pillars with rollup: active milestones, open tasks, minutes this week."""
    pillars = conn.execute(
        "SELECT * FROM pillars ORDER BY sort_order, id"
    ).fetchall()
    out = []
    for p in pillars:
        d = row_to_dict(p)
        d["active_milestones"] = conn.execute(
            "SELECT COUNT(*) FROM milestones WHERE pillar_id = ? AND status = 'active'",
            (p["id"],),
        ).fetchone()[0]
        d["open_tasks"] = conn.execute(
            "SELECT COUNT(*) FROM tasks WHERE pillar_id = ? AND status IN ('todo','doing')",
            (p["id"],),
        ).fetchone()[0]
        d["minutes_this_week"] = _minutes_this_week(conn, p["id"])
        out.append(d)
    return out


def get_pillar(conn: sqlite3.Connection, slug: str) -> dict:
    """One pillar with its milestones (each with derived progress %)."""
    p = require_pillar(conn, slug)
    d = row_to_dict(p)
    milestones = conn.execute(
        """
        SELECT m.*, vp.total_tasks, vp.done_tasks, vp.progress
        FROM milestones m
        LEFT JOIN v_milestone_progress vp ON vp.milestone_id = m.id
        WHERE m.pillar_id = ?
        ORDER BY m.sort_order, m.id
        """,
        (p["id"],),
    ).fetchall()
    d["milestones"] = rows_to_dicts(milestones)
    d["minutes_this_week"] = _minutes_this_week(conn, p["id"])
    return d
