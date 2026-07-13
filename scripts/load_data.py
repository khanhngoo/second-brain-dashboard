"""Load a JSON export (from ``scripts/dump_data.py``) into the SQLite DB.

Usage:
    python scripts/load_data.py [input_path]

Default input: data/export.json (relative to repo root).
The DB path is resolved the same way the app resolves it
(``SECONDBRAIN_DB`` env var, else ``~/.secondbrain/db.sqlite``).

Assumes the target DB schema already exists (run ``secondbrain`` init /
``init_db`` first). Uses INSERT OR REPLACE keyed on each table's primary key,
so re-running is idempotent and updates existing rows in place.
"""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from secondbrain.config import db_path  # noqa: E402


def load(db_file: Path, export: dict) -> dict:
    conn = sqlite3.connect(db_file)
    cur = conn.cursor()

    # Existing real tables in the target DB — only load into those.
    existing = {
        r[0]
        for r in cur.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchall()
    }

    counts: dict = {}
    for table, rows in export["data"].items():
        if table not in existing:
            print(f"  skip {table}: not in target DB")
            continue
        if not rows:
            counts[table] = 0
            continue
        cols = list(rows[0].keys())
        placeholders = ", ".join("?" for _ in cols)
        col_list = ", ".join(cols)
        sql = f"INSERT OR REPLACE INTO {table} ({col_list}) VALUES ({placeholders})"
        cur.executemany(sql, [[row[c] for c in cols] for row in rows])
        counts[table] = len(rows)

    conn.commit()
    conn.close()
    return counts


def main() -> None:
    inp = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO_ROOT / "data" / "export.json"
    if not inp.exists():
        raise SystemExit(f"Export not found: {inp}")

    export = json.loads(inp.read_text())
    db_file = db_path()
    counts = load(db_file, export)

    print(f"Loaded into {db_file}")
    for t, n in counts.items():
        print(f"  {t}: {n}")


if __name__ == "__main__":
    main()
