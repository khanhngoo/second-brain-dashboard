"""Idempotent database initialization.

P0 uses a single ``schema.sql`` (no migration framework — greenfield, single
user). ``PRAGMA user_version`` is set in the schema as a hook for a future
migration step.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from .connection import connect

_SCHEMA_PATH = Path(__file__).with_name("schema.sql")


def init_db(conn: sqlite3.Connection) -> None:
    """Create tables/views if absent. Safe to call repeatedly."""
    schema = _SCHEMA_PATH.read_text()
    conn.executescript(schema)
    conn.commit()


def init_db_at(path: str | Path | None = None) -> None:
    """Open the database at ``path`` (default: configured path) and initialize it."""
    conn = connect(path)
    try:
        init_db(conn)
    finally:
        conn.close()
