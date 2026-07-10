"""Seed data: the seven fixed pillars + a few sample milestones/tasks.

Pillars are inserted directly (they're the fixed foundation). Milestones and
tasks go through the core.create_* functions so seeding exercises the same
validation real callers hit.
"""

from __future__ import annotations

import sqlite3

from . import clock, core

# The seven pillars, in order, with distinct default colors.
PILLARS = [
    ("skills", "Skills", "#6C5CE7"),
    ("mindset_soft_skills", "Mindset & Soft Skills", "#E17055"),
    ("network", "Network", "#00B894"),
    ("personal_brand", "Personal Brand", "#0984E3"),
    ("energy", "Energy", "#E84393"),
    ("assets", "Assets", "#FDCB6E"),
    ("outcomes", "Outcomes", "#636E72"),
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
        conn, title="Ship Second Brain P0",
        description="Foundation: schema, MCP, HTTP, CLI.",
    )
    core.create_task(
        conn, pillar="skills", title="Write the SQLite schema",
        milestone=m["id"], is_effort=True, is_impact=True,
    )
    t2 = core.create_task(
        conn, pillar="skills", title="Wire the MCP server",
        milestone=m["id"], is_impact=True,
    )
    core.set_task_status(conn, t2["id"], "doing")

    core.create_task(
        conn, pillar="energy", title="Morning run",
        is_effort=False, is_impact=True,
    )
    core.create_task(
        conn, pillar="outcomes", title="Read one paper",
        is_impact=True,
    )


def seed(conn: sqlite3.Connection, *, reset: bool = False, with_samples: bool = True) -> None:
    if reset:
        for table in ("sessions", "time_blocks", "subtasks", "tasks",
                      "milestones", "external_events", "calendar_accounts", "pillars"):
            conn.execute(f"DELETE FROM {table}")
        conn.commit()
    seed_pillars(conn)
    if with_samples and conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0] == 0:
        seed_samples(conn)
