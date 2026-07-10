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
    t = core.create_task(seeded_db, pillar="energy", title="t")
    core.add_subtask(seeded_db, t["id"], "s")
    with seeded_db:
        seeded_db.execute("DELETE FROM tasks WHERE id = ?", (t["id"],))
    n = seeded_db.execute(
        "SELECT COUNT(*) FROM subtasks WHERE task_id = ?", (t["id"],)
    ).fetchone()[0]
    assert n == 0


def test_delete_task_with_sessions_is_restricted(seeded_db):
    t = core.create_task(seeded_db, pillar="energy", title="t")
    core.log_session(seeded_db, t["id"], 10)
    with pytest.raises(sqlite3.IntegrityError):
        with seeded_db:
            seeded_db.execute("DELETE FROM tasks WHERE id = ?", (t["id"],))


def test_views_exist_and_compute(seeded_db):
    m = core.create_milestone(seeded_db, title="M")
    core.create_task(seeded_db, pillar="skills", title="t", milestone=m["id"])
    row = seeded_db.execute(
        "SELECT total_tasks, done_tasks, progress FROM v_milestone_progress WHERE milestone_id = ?",
        (m["id"],),
    ).fetchone()
    assert row["total_tasks"] == 1 and row["done_tasks"] == 0 and row["progress"] == 0.0


def test_v3_to_v4_migration_drops_milestone_pillar_id(db_path):
    """A pre-existing v3 DB (milestones.pillar_id NOT NULL) migrates cleanly:
    the column is dropped and existing rows survive with the same id/title."""
    from secondbrain.db.init_db import init_db

    conn = connect(db_path)
    conn.executescript(
        """
        PRAGMA user_version = 3;
        CREATE TABLE pillars (
            id INTEGER PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
            description TEXT, color TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL
        );
        CREATE TABLE milestones (
            id INTEGER PRIMARY KEY,
            pillar_id INTEGER NOT NULL REFERENCES pillars(id),
            title TEXT NOT NULL, description TEXT,
            status TEXT NOT NULL DEFAULT 'active', target_date TEXT,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL, completed_at TEXT
        );
        CREATE VIEW v_milestone_progress AS
        SELECT m.id AS milestone_id, 0 AS total_tasks, 0 AS done_tasks, NULL AS progress
        FROM milestones m;
        INSERT INTO pillars (slug, name, sort_order, created_at)
            VALUES ('skills', 'Skills', 0, '2026-01-01');
        INSERT INTO milestones (id, pillar_id, title, created_at)
            VALUES (1, 1, 'Pre-existing milestone', '2026-01-01');
        """
    )
    conn.commit()
    conn.close()

    conn = connect(db_path)
    init_db(conn)

    columns = {row["name"] for row in conn.execute("PRAGMA table_info(milestones)").fetchall()}
    assert "pillar_id" not in columns

    row = conn.execute("SELECT * FROM milestones WHERE id = 1").fetchone()
    assert row["title"] == "Pre-existing milestone"
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 4
    conn.close()
