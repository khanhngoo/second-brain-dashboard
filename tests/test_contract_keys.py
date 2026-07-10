"""Contract-drift guard: route JSON key-sets must match the hand-written TS types
in web/src/api/types.ts. If the backend adds/removes a field, this fails and the
TS type must be updated in lockstep (the frontend's only contract).
"""

import pytest

from secondbrain import core
from secondbrain.seed import seed_pillars

TASK_KEYS = {
    "id", "pillar_id", "milestone_id", "title", "description", "status",
    "is_impact", "is_effort",
    "due_date", "note_ref", "sort_order", "created_at", "completed_at",
}
ARCHIVED_TASK_KEYS = {
    "id", "pillar_id", "pillar_slug", "pillar_name", "pillar_color",
    "milestone_id", "milestone_title", "title", "description", "status",
    "is_impact", "is_effort",
    "actual_duration_min", "due_date", "note_ref", "sort_order",
    "created_at", "completed_at",
}
BRIEF_KEYS = {
    "date", "blocks", "external_events", "due_today", "overdue",
    "in_progress", "unconfirmed_blocks", "week_pillar_minutes",
}
PILLAR_ROLLUP_KEYS = {
    "id", "slug", "name", "description", "color", "sort_order", "created_at",
    "open_tasks", "minutes_this_week",
}
KANBAN_KEYS = {"todo", "doing", "done"}
IMPACT_EFFORT_KEYS = {
    "high_impact_low_effort", "high_impact_high_effort",
    "low_impact_low_effort", "low_impact_high_effort",
}
PILLAR_TIME_KEYS = {"pillar_id", "slug", "name", "bucket", "minutes"}


@pytest.fixture
def populated(db):
    seed_pillars(db)
    m = core.create_milestone(db, title="M")
    t = core.create_task(db, pillar="skills", title="t", milestone=m["id"])
    core.log_session(db, t["id"], 40, started_at="2026-06-20T08:00:00+00:00")
    return db


def test_today_brief_keys(populated):
    assert set(core.get_today_brief(populated).keys()) == BRIEF_KEYS


def test_task_keys(populated):
    rows = core.list_tasks(populated)
    assert set(rows[0].keys()) == TASK_KEYS


def test_archived_task_keys(populated):
    task = core.list_tasks(populated)[0]
    core.set_task_status(populated, task["id"], "done")
    rows = core.list_archived_tasks(populated)
    assert set(rows[0].keys()) == ARCHIVED_TASK_KEYS


def test_pillar_rollup_keys(populated):
    assert set(core.get_pillars(populated)[0].keys()) == PILLAR_ROLLUP_KEYS


def test_kanban_keys(populated):
    assert set(core.get_kanban(populated).keys()) == KANBAN_KEYS


def test_impact_effort_keys(populated):
    assert set(core.get_impact_effort(populated).keys()) == IMPACT_EFFORT_KEYS


def test_pillar_time_keys(populated):
    rows = core.get_pillar_time(populated, "week")
    assert set(rows[0].keys()) == PILLAR_TIME_KEYS
