"""Board reads: kanban (by status) and Eisenhower (by urgent x important)."""

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


def get_eisenhower(conn: sqlite3.Connection, pillar: int | str | None = None) -> dict:
    """Tasks grouped into the four quadrants (archived/done excluded)."""
    clause, params = _filter(conn, pillar)
    extra = "status NOT IN ('archived','done')"
    where = f"{clause} AND {extra}" if clause else f"WHERE {extra}"
    rows = conn.execute(
        f"SELECT * FROM tasks {where} ORDER BY sort_order, id", params
    ).fetchall()
    buckets = {
        "urgent_important": [],
        "not_urgent_important": [],
        "urgent_not_important": [],
        "not_urgent_not_important": [],
    }
    for r in rows:
        if r["is_urgent"] and r["is_important"]:
            buckets["urgent_important"].append(dict(r))
        elif not r["is_urgent"] and r["is_important"]:
            buckets["not_urgent_important"].append(dict(r))
        elif r["is_urgent"] and not r["is_important"]:
            buckets["urgent_not_important"].append(dict(r))
        else:
            buckets["not_urgent_not_important"].append(dict(r))
    return buckets
