"""SQLite connection helpers.

Every connection enables foreign keys (SQLite defaults them OFF, and the pragma
is connection-scoped — not persisted), uses WAL (the MCP and HTTP processes
share one file), and returns ``sqlite3.Row`` rows so the core gets dict-like
access.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path

from .. import config


def _prepare(conn: sqlite3.Connection, *, read_only: bool) -> sqlite3.Connection:
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    if read_only:
        conn.execute("PRAGMA query_only = ON")
    else:
        conn.execute("PRAGMA journal_mode = WAL")
    return conn


def connect(path: str | Path | None = None, *, read_only: bool = False) -> sqlite3.Connection:
    """Open a connection to the database.

    ``read_only=True`` opens in SQLite's URI ``mode=ro`` — the engine refuses
    every write, which is the authoritative guard behind the ``query(sql)``
    escape hatch.
    """
    target = Path(path) if path is not None else config.db_path()
    # check_same_thread=False: the FastAPI TestClient (and uvicorn) dispatch
    # routes on worker threads while we hold one long-lived connection. Access
    # is still effectively serialized — every write goes through `with conn:`.
    if read_only:
        uri = f"file:{target}?mode=ro"
        conn = sqlite3.connect(uri, uri=True, check_same_thread=False)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(target, check_same_thread=False)
    return _prepare(conn, read_only=read_only)
