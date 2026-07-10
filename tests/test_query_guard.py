"""query(sql) read-only guard: writes rejected at engine + parse level, DB unchanged."""

import pytest

from secondbrain import core
from secondbrain.errors import ReadOnlyViolation


def test_select_returns_rows(seeded_db, db_path):
    core.create_task(seeded_db, pillar="energy", title="t")
    res = core.query("SELECT COUNT(*) AS c FROM tasks", db_path)
    assert res["rows"][0]["c"] == 1


def test_cte_with_select_allowed(seeded_db, db_path):
    res = core.query("WITH x AS (SELECT 1 AS n) SELECT n FROM x", db_path)
    assert res["rows"][0]["n"] == 1


@pytest.mark.parametrize("sql", [
    "DELETE FROM tasks",
    "UPDATE tasks SET title = 'x'",
    "INSERT INTO tasks (pillar_id, title, created_at) VALUES (1,'x','now')",
    "DROP TABLE tasks",
    "PRAGMA foreign_keys = OFF",
    "ATTACH DATABASE 'x.db' AS y",
    "SELECT 1; DELETE FROM tasks",
])
def test_non_select_rejected_and_db_unchanged(seeded_db, db_path, sql):
    core.create_task(seeded_db, pillar="energy", title="keep")
    before = seeded_db.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    with pytest.raises(ReadOnlyViolation):
        core.query(sql, db_path)
    after = seeded_db.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    assert before == after
