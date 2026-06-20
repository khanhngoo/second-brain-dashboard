"""query(sql) — the read-only SQL escape hatch (docs/03).

Defense in depth:
  1. open the DB in SQLite URI mode=ro  -> the engine refuses every write;
  2. PRAGMA query_only = ON             -> belt-and-suspenders;
  3. a statement parse-guard            -> single statement, leading SELECT/WITH only.

mode=ro is the authoritative guard; the parse-guard gives a clean error instead
of a SQLite write-protection error and blocks stacked statements.
"""

from __future__ import annotations

from pathlib import Path

from ..errors import ReadOnlyViolation
from ..db.connection import connect

_MAX_ROWS = 1000


def _strip_comments(sql: str) -> str:
    out, i, n = [], 0, len(sql)
    while i < n:
        two = sql[i:i + 2]
        if two == "--":
            nl = sql.find("\n", i)
            i = n if nl == -1 else nl
        elif two == "/*":
            end = sql.find("*/", i + 2)
            i = n if end == -1 else end + 2
        else:
            out.append(sql[i])
            i += 1
    return "".join(out)


def _guard(sql: str) -> str:
    cleaned = _strip_comments(sql).strip()
    if not cleaned:
        raise ReadOnlyViolation("empty query")
    # Reject stacked statements (allow a single trailing semicolon).
    body = cleaned[:-1] if cleaned.endswith(";") else cleaned
    if ";" in body:
        raise ReadOnlyViolation("only a single statement is allowed")
    first = body.lstrip().split(None, 1)[0].lower()
    if first not in ("select", "with"):
        raise ReadOnlyViolation(f"only SELECT/WITH queries are allowed; got {first.upper()!r}")
    return body


def query(sql: str, path: str | Path | None = None) -> dict:
    """Run a read-only SELECT and return {columns, rows, truncated}."""
    body = _guard(sql)
    conn = connect(path, read_only=True)
    try:
        cur = conn.execute(body)
        columns = [c[0] for c in cur.description] if cur.description else []
        fetched = cur.fetchmany(_MAX_ROWS + 1)
        truncated = len(fetched) > _MAX_ROWS
        rows = [dict(r) for r in fetched[:_MAX_ROWS]]
    finally:
        conn.close()
    return {"columns": columns, "rows": rows, "truncated": truncated}
