"""get_today_brief — the centerpiece read (docs/01).

Runs the auto-log sweep first (lazy-on-read; P0 has no daemon), then assembles
the morning brief: today's blocks + external events, due-today + overdue +
in-progress tasks, yesterday's unconfirmed auto-logged blocks, and this week's
per-pillar minutes.
"""

from __future__ import annotations

import sqlite3

from .. import clock
from .blocks import list_blocks_on, run_autolog_sweep
from .pillars import _week_start_iso
from .serialize import rows_to_dicts


def _today_iso(date: str | None) -> str:
    if date is not None:
        return date[:10]
    return clock.now_utc().date().isoformat()


def get_today_brief(conn: sqlite3.Connection, date: str | None = None) -> dict:
    run_autolog_sweep(conn)
    today = _today_iso(date)

    external_events = rows_to_dicts(
        conn.execute(
            "SELECT * FROM external_events WHERE date(start_at) = date(?) ORDER BY start_at",
            (today,),
        ).fetchall()
    )

    due_today = rows_to_dicts(
        conn.execute(
            """
            SELECT * FROM tasks
            WHERE status NOT IN ('done','archived')
              AND due_date IS NOT NULL AND date(due_date) = date(?)
            ORDER BY sort_order, id
            """,
            (today,),
        ).fetchall()
    )

    overdue = rows_to_dicts(
        conn.execute(
            """
            SELECT * FROM tasks
            WHERE status NOT IN ('done','archived')
              AND due_date IS NOT NULL AND date(due_date) < date(?)
            ORDER BY due_date, id
            """,
            (today,),
        ).fetchall()
    )

    in_progress = rows_to_dicts(
        conn.execute(
            "SELECT * FROM tasks WHERE status = 'doing' ORDER BY sort_order, id"
        ).fetchall()
    )

    # Yesterday's auto-logged blocks still awaiting confirm/skip.
    unconfirmed = rows_to_dicts(
        conn.execute(
            """
            SELECT * FROM time_blocks
            WHERE auto_logged = 1 AND confirmed = 0
              AND date(end_at) < date(?)
            ORDER BY end_at
            """,
            (today,),
        ).fetchall()
    )

    monday = _week_start_iso(conn)
    week_pillar_minutes = rows_to_dicts(
        conn.execute(
            """
            SELECT p.id AS pillar_id, p.slug, p.name,
                   COALESCE(SUM(vpt.minutes), 0) AS minutes
            FROM pillars p
            LEFT JOIN v_pillar_time vpt
                   ON vpt.pillar_id = p.id AND vpt.day >= ?
            GROUP BY p.id
            ORDER BY p.sort_order
            """,
            (monday,),
        ).fetchall()
    )

    return {
        "date": today,
        "blocks": list_blocks_on(conn, today),
        "external_events": external_events,
        "due_today": due_today,
        "overdue": overdue,
        "in_progress": in_progress,
        "unconfirmed_blocks": unconfirmed,
        "week_pillar_minutes": week_pillar_minutes,
    }
