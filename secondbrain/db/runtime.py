"""Process-wide writable connection for the long-lived adapters (MCP, HTTP).

Lazily opens one connection on the configured DB path, initializing the schema
on first use. Front doors call ``get_conn()``; the read-only ``query`` path
opens its own connection by path instead (see core/rawquery.py).
"""

from __future__ import annotations

import sqlite3

from .. import config
from .connection import connect
from .init_db import init_db

_conn: sqlite3.Connection | None = None


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = connect(config.db_path())
        init_db(_conn)
    return _conn


def reset_conn() -> None:
    """Drop the cached connection (used by tests that switch DB paths)."""
    global _conn
    if _conn is not None:
        _conn.close()
    _conn = None
