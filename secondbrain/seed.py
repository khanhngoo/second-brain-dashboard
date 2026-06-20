"""Seed data: the five fixed pillars + a few sample milestones/tasks.

Pillars are inserted directly (they're the fixed foundation). Milestones and
tasks go through the core.create_* functions so seeding exercises the same
validation and the pillar/milestone invariant real callers hit.
"""

from __future__ import annotations

import sqlite3

from . import clock, core

# docs/01 — the five pillars, in order, with distinct default colors.
PILLARS = [
    ("polymath_knowledge", "Polymath Knowledge", "#6C5CE7"),
    ("founder_mindset", "Founder Mindset", "#E17055"),
    ("body_temple", "Body Temple", "#00B894"),
    ("cracked_engineer", "Cracked Engineer", "#0984E3"),
    ("soul_connection", "Soul Connection", "#E84393"),
]


def seed_pillars(conn: sqlite3.Connection) -> None:
    now = clock.now_utc_iso()
    for i, (slug, name, color) in enumerate(PILLARS):
        conn.execute(
            """
            INSERT OR IGNORE INTO pillars (slug, name, color, sort_order, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (slug, name, color, i, now),
        )
    conn.commit()


def seed_samples(conn: sqlite3.Connection) -> None:
    """A handful of milestones/tasks so boards, the brief, and analytics have content."""
    m = core.create_milestone(
        conn, pillar="cracked_engineer", title="Ship Second Brain P0",
        description="Foundation: schema, MCP, HTTP, CLI.",
    )
    core.create_task(
        conn, pillar="cracked_engineer", title="Write the SQLite schema",
        milestone=m["id"], is_urgent=True, is_important=True,
        estimated_duration_min=90,
    )
    t2 = core.create_task(
        conn, pillar="cracked_engineer", title="Wire the MCP server",
        milestone=m["id"], is_important=True, estimated_duration_min=120,
    )
    core.set_task_status(conn, t2["id"], "doing")

    core.create_task(
        conn, pillar="body_temple", title="Morning run",
        is_urgent=False, is_important=True, estimated_duration_min=30,
    )
    core.create_task(
        conn, pillar="polymath_knowledge", title="Read one paper",
        is_important=True, estimated_duration_min=45,
    )


def seed(conn: sqlite3.Connection, *, reset: bool = False, with_samples: bool = True) -> None:
    if reset:
        for table in ("timers", "sessions", "time_blocks", "subtasks", "tasks",
                      "milestones", "external_events", "calendar_accounts", "pillars"):
            conn.execute(f"DELETE FROM {table}")
        conn.commit()
    seed_pillars(conn)
    if with_samples and conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 0:
        seed_samples(conn)
