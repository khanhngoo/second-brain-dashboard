"""The core invariants: pillar/milestone, session-vs-status, rollups, pillar time."""

import pytest

from secondbrain import core
from secondbrain.errors import ValidationError


# --- pillar/milestone invariant (docs/02:68) ------------------------------

def test_create_task_with_milestone_forces_pillar(seeded_db):
    m = core.create_milestone(seeded_db, pillar="cracked_engineer", title="M")
    t = core.create_task(seeded_db, title="t", milestone=m["id"])
    assert t["pillar_id"] == m["pillar_id"]


def test_conflicting_pillar_raises(seeded_db):
    m = core.create_milestone(seeded_db, pillar="cracked_engineer", title="M")
    with pytest.raises(ValidationError):
        core.create_task(seeded_db, pillar="body_temple", title="bad", milestone=m["id"])


def test_update_to_foreign_milestone_revalidates_pillar(seeded_db):
    m = core.create_milestone(seeded_db, pillar="cracked_engineer", title="M")
    t = core.create_task(seeded_db, pillar="body_temple", title="t")
    # Moving the task under a cracked_engineer milestone realigns its pillar.
    updated = core.update_task(seeded_db, t["id"], milestone_id=m["id"])
    assert updated["pillar_id"] == m["pillar_id"]


# --- session-vs-status independence (docs/02 + docs/04) -------------------

def test_log_session_never_changes_status(seeded_db):
    t = core.create_task(seeded_db, pillar="body_temple", title="t")
    core.log_session(seeded_db, t["id"], 40)
    core.log_session(seeded_db, t["id"], 25)
    assert core.get_task(seeded_db, t["id"])["status"] == "todo"
    assert core.get_task(seeded_db, t["id"])["sessions_total_min"] == 65


def test_set_status_done_with_zero_sessions(seeded_db):
    t = core.create_task(seeded_db, pillar="body_temple", title="t")
    out = core.set_task_status(seeded_db, t["id"], "done")
    assert out["status"] == "done" and out["completed_at"] is not None


def test_update_task_cannot_change_status(seeded_db):
    t = core.create_task(seeded_db, pillar="body_temple", title="t")
    with pytest.raises(ValidationError):
        core.update_task(seeded_db, t["id"], status="done")


# --- milestone rollup -----------------------------------------------------

def test_milestone_progress_quarter(seeded_db):
    m = core.create_milestone(seeded_db, pillar="cracked_engineer", title="M")
    ids = [core.create_task(seeded_db, title="t", milestone=m["id"])["id"] for _ in range(4)]
    core.set_task_status(seeded_db, ids[0], "done")
    prog = core.list_milestones(seeded_db, pillar="cracked_engineer")[0]["progress"]
    assert prog == 0.25


def test_archived_task_drops_from_denominator(seeded_db):
    m = core.create_milestone(seeded_db, pillar="cracked_engineer", title="M")
    ids = [core.create_task(seeded_db, title="t", milestone=m["id"])["id"] for _ in range(4)]
    core.set_task_status(seeded_db, ids[0], "done")
    core.set_task_status(seeded_db, ids[1], "archived")
    prog = core.list_milestones(seeded_db, pillar="cracked_engineer")[0]["progress"]
    assert prog == pytest.approx(1 / 3)


# --- pillar time ----------------------------------------------------------

def test_pillar_time_sums_per_pillar(seeded_db):
    a = core.create_task(seeded_db, pillar="body_temple", title="a")
    b = core.create_task(seeded_db, pillar="cracked_engineer", title="b")
    core.log_session(seeded_db, a["id"], 30, started_at="2026-06-20T08:00:00+00:00")
    core.log_session(seeded_db, b["id"], 50, started_at="2026-06-20T08:00:00+00:00")
    rows = core.get_pillar_time(seeded_db, "day", start="2026-06-20", end="2026-06-20")
    mins = {r["slug"]: r["minutes"] for r in rows}
    assert mins["body_temple"] == 30 and mins["cracked_engineer"] == 50
