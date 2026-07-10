from __future__ import annotations

import pytest

from secondbrain import core
from secondbrain.errors import NotFoundError


def test_update_milestone_title_and_date(seeded_db):
    m = core.create_milestone(seeded_db, title="Old title")
    updated = core.update_milestone(
        seeded_db, m["id"], title="New title", target_date="2026-08-01"
    )
    assert updated["title"] == "New title"
    assert updated["target_date"] == "2026-08-01"


def test_delete_milestone_unlinks_tasks(seeded_db):
    m = core.create_milestone(seeded_db, title="M")
    t = core.create_task(seeded_db, pillar="skills", title="t", milestone=m["id"])

    core.delete_milestone(seeded_db, m["id"])

    refreshed = core.get_task(seeded_db, t["id"])
    assert refreshed["milestone_id"] is None

    assert m["id"] not in [x["id"] for x in core.list_milestones(seeded_db)]


def test_delete_missing_milestone_raises(seeded_db):
    with pytest.raises(NotFoundError):
        core.delete_milestone(seeded_db, 99999)
