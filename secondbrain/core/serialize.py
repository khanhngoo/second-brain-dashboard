"""Row -> dict shaping helpers.

Keeps a stable, JSON-serializable shape so an HTTP response and an MCP tool
result are identical for the same core call (the parity guarantee).
"""

from __future__ import annotations

import sqlite3


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row is not None else None


def rows_to_dicts(rows) -> list[dict]:
    return [dict(r) for r in rows]
