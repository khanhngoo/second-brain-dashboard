"""Dump all real (non-view) tables from the SQLite DB into a single JSON file.

Usage:
    python scripts/dump_data.py [output_path]

Default output: data/export.json (relative to repo root).
The DB path is resolved the same way the app resolves it
(``SECONDBRAIN_DB`` env var, else ``~/.secondbrain/db.sqlite``).

The companion loader ``scripts/load_data.py`` reads this file back into a DB.
"""

from __future__ import annotations

import json
import sqlite3
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT))

from secondbrain.config import db_path  # noqa: E402


def dump(db_file: Path) -> dict:
    conn = sqlite3.connect(db_file)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Real tables only — skip views (v_*) and sqlite internals.
    tables = [
        r[0]
        for r in cur.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type='table' AND name NOT LIKE 'sqlite_%' "
            "ORDER BY name"
        ).fetchall()
    ]

    export: dict = {"_meta": {"source_db": str(db_file), "tables": tables}, "data": {}}
    for table in tables:
        rows = cur.execute(f"SELECT * FROM {table}").fetchall()
        export["data"][table] = [dict(row) for row in rows]

    conn.close()
    return export


def main() -> None:
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO_ROOT / "data" / "export.json"
    db_file = db_path()
    if not db_file.exists():
        raise SystemExit(f"DB not found: {db_file}")

    export = dump(db_file)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(export, indent=2, ensure_ascii=False, default=str))

    counts = {t: len(rows) for t, rows in export["data"].items()}
    print(f"Wrote {out}")
    for t, n in counts.items():
        print(f"  {t}: {n}")


if __name__ == "__main__":
    main()
