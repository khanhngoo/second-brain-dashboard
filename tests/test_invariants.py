"""The core invariants: pillar resolution, session-vs-status, rollups, pillar time."""

import pytest

from secondbrain import core
from secondbrain.errors import ValidationError


# --- milestones are pillar-agnostic ----------------------------------------

def test_task_under_milestone_keeps_its_own_pillar(seeded_db):
    m = core.create_milestone(seeded_db, title="M")
    t = core.create_task(seeded_db, pillar="energy", title="t", milestone=m["id"])
    assert t["pillar_id"] == core.get_pillar(seeded_db, "energy")["id"]


def test_milestone_can_hold_tasks_from_different_pillars(seeded_db):
    m = core.create_milestone(seeded_db, title="M")
    a = core.create_task(seeded_db, pillar="energy", title="a", milestone=m["id"])
    b = core.create_task(seeded_db, pillar="skills", title="b", milestone=m["id"])
    assert a["pillar_id"] != b["pillar_id"]
    assert a["milestone_id"] == b["milestone_id"] == m["id"]


def test_create_task_without_pillar_or_milestone_pillar_raises(seeded_db):
    with pytest.raises(ValidationError):
        core.create_task(seeded_db, title="t")


def test_update_task_to_milestone_keeps_current_pillar(seeded_db):
    m = core.create_milestone(seeded_db, title="M")
    t = core.create_task(seeded_db, pillar="energy", title="t")
    updated = core.update_task(seeded_db, t["id"], milestone_id=m["id"])
    assert updated["pillar_id"] == t["pillar_id"]
    assert updated["milestone_id"] == m["id"]


# --- session-vs-status independence (docs/02 + docs/04) -------------------

def test_log_session_never_changes_status(seeded_db):
    t = core.create_task(seeded_db, pillar="energy", title="t")
    core.log_session(seeded_db, t["id"], 40)
    core.log_session(seeded_db, t["id"], 25)
    assert core.get_task(seeded_db, t["id"])["status"] == "todo"
    assert core.get_task(seeded_db, t["id"])["sessions_total_min"] == 65


def test_set_status_done_with_zero_sessions(seeded_db):
    t = core.create_task(seeded_db, pillar="energy", title="t")
    out = core.set_task_status(seeded_db, t["id"], "done")
    assert out["status"] == "done" and out["completed_at"] is not None


def test_update_task_cannot_change_status(seeded_db):
    t = core.create_task(seeded_db, pillar="energy", title="t")
    with pytest.raises(ValidationError):
        core.update_task(seeded_db, t["id"], status="done")


# --- milestone rollup -----------------------------------------------------

def test_milestone_progress_quarter(seeded_db):
    m = core.create_milestone(seeded_db, title="M")
    ids = [
        core.create_task(seeded_db, pillar="skills", title="t", milestone=m["id"])["id"]
        for _ in range(4)
    ]
    core.set_task_status(seeded_db, ids[0], "done")
    prog = [row for row in core.list_milestones(seeded_db) if row["id"] == m["id"]][0]["progress"]
    assert prog == 0.25


def test_archived_task_drops_from_denominator(seeded_db):
    m = core.create_milestone(seeded_db, title="M")
    ids = [
        core.create_task(seeded_db, pillar="skills", title="t", milestone=m["id"])["id"]
        for _ in range(4)
    ]
    core.set_task_status(seeded_db, ids[0], "done")
    core.set_task_status(seeded_db, ids[1], "archived")
    prog = [row for row in core.list_milestones(seeded_db) if row["id"] == m["id"]][0]["progress"]
    assert prog == pytest.approx(1 / 3)


# --- pillar time ----------------------------------------------------------

def test_pillar_time_sums_per_pillar(seeded_db):
    a = core.create_task(seeded_db, pillar="energy", title="a")
    b = core.create_task(seeded_db, pillar="skills", title="b")
    core.log_session(seeded_db, a["id"], 30, started_at="2026-06-20T08:00:00+00:00")
    core.log_session(seeded_db, b["id"], 50, started_at="2026-06-20T08:00:00+00:00")
    rows = core.get_pillar_time(seeded_db, "day", start="2026-06-20", end="2026-06-20")
    mins = {r["slug"]: r["minutes"] for r in rows}
    assert mins["energy"] == 30 and mins["skills"] == 50
