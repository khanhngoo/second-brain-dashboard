"""Schema-level guarantees: FK pragma, ON DELETE choices, views compute."""

import sqlite3

import pytest

from secondbrain import clock, core
from secondbrain.db.connection import connect


def test_foreign_keys_on_for_fresh_connection(db_path):
    from secondbrain.db.init_db import init_db
    conn = connect(db_path)
    init_db(conn)
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_subtask_under_missing_task_fails(seeded_db):
    with pytest.raises(sqlite3.IntegrityError):
        seeded_db.execute(
            "INSERT INTO subtasks (task_id, title, created_at) VALUES (999, 'x', ?)",
            (clock.now_utc_iso(),),
        )
        seeded_db.commit()


def test_delete_task_cascades_subtasks(seeded_db):
    t = core.create_task(seeded_db, pillar="body_temple", title="t")
    core.add_subtask(seeded_db, t["id"], "s")
    with seeded_db:
        seeded_db.execute("DELETE FROM tasks WHERE id = ?", (t["id"],))
    n = seeded_db.execute(
        "SELECT COUNT(*) FROM subtasks WHERE task_id = ?", (t["id"],)
    ).fetchone()[0]
    assert n == 0


def test_delete_task_with_sessions_is_restricted(seeded_db):
    t = core.create_task(seeded_db, pillar="body_temple", title="t")
    core.log_session(seeded_db, t["id"], 10)
    with pytest.raises(sqlite3.IntegrityError):
        with seeded_db:
            seeded_db.execute("DELETE FROM tasks WHERE id = ?", (t["id"],))


def test_views_exist_and_compute(seeded_db):
    m = core.create_milestone(seeded_db, pillar="cracked_engineer", title="M")
    core.create_task(seeded_db, pillar="cracked_engineer", title="t", milestone=m["id"])
    row = seeded_db.execute(
        "SELECT total_tasks, done_tasks, progress FROM v_milestone_progress WHERE milestone_id = ?",
        (m["id"],),
    ).fetchone()
    assert row["total_tasks"] == 1 and row["done_tasks"] == 0 and row["progress"] == 0.0
