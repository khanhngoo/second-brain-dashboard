"""Idempotent database initialization.

P0 uses a single ``schema.sql`` (no migration framework — greenfield, single
user) plus targeted ``PRAGMA user_version``-gated migrations for changes that
``CREATE TABLE IF NOT EXISTS`` can't express (e.g. dropping a column/constraint
from an already-created table).
"""

from __future__ import annotations

import sqlite3
from collections.abc import Callable
from pathlib import Path

from .connection import connect

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def _migrate_v4_drop_milestone_pillar(conn: sqlite3.Connection) -> None:
    """v3 -> v4: milestones.pillar_id removed — milestones are pillar-agnostic.

    SQLite can't ALTER a column's constraints in place, so this rebuilds the
    table: create the new shape, copy data (dropping pillar_id), swap it in.
    Runs outside the executescript transaction with foreign_keys off, per
    SQLite's documented procedure for schema changes on referenced tables.
    """
    has_pillar_id = any(
        row["name"] == "pillar_id"
        for row in conn.execute("PRAGMA table_info(milestones)").fetchall()
    )
    if not has_pillar_id:
        return
    conn.execute("PRAGMA foreign_keys = OFF")
    with conn:
        # Views referencing milestones must be dropped before the table swap
        # (SQLite validates view definitions against the live schema on
        # rename/drop) — executescript(schema) recreates them right after.
        conn.execute("DROP VIEW IF EXISTS v_milestone_progress")
        conn.execute(
            """
            CREATE TABLE milestones_new (
                id           INTEGER PRIMARY KEY,
                title        TEXT NOT NULL,
                description  TEXT,
                status       TEXT NOT NULL DEFAULT 'active',
                target_date  TEXT,
                sort_order   INTEGER NOT NULL DEFAULT 0,
                created_at   TEXT NOT NULL,
                completed_at TEXT
            )
            """
        )
        conn.execute(
            """
            INSERT INTO milestones_new
                (id, title, description, status, target_date, sort_order,
                 created_at, completed_at)
            SELECT id, title, description, status, target_date, sort_order,
                   created_at, completed_at
            FROM milestones
            """
        )
        conn.execute("DROP TABLE milestones")
        conn.execute("ALTER TABLE milestones_new RENAME TO milestones")
        conn.execute("DROP INDEX IF EXISTS idx_milestones_pillar")
    conn.execute("PRAGMA foreign_keys = ON")


_MIGRATIONS: list[tuple[int, Callable[[sqlite3.Connection], None]]] = [
    (4, _migrate_v4_drop_milestone_pillar),
]


def init_db(conn: sqlite3.Connection) -> None:
    """Create tables/views if absent, then apply any pending migrations."""
    schema = _SCHEMA_PATH.read_text()
    current_version = conn.execute("PRAGMA user_version").fetchone()[0]

    for target_version, migrate in _MIGRATIONS:
        if current_version < target_version:
            migrate(conn)

    conn.executescript(schema)
    conn.commit()


def init_db_at(path: str | Path | None = None) -> None:
    """Open the database at ``path`` (default: configured path) and initialize it."""
    conn = connect(path)
    try:
        init_db(conn)
    finally:
        conn.close()
