from secondbrain import core


def test_archive_lists_done_tasks_with_actual_duration(seeded_db, frozen_clock):
    milestone = core.create_milestone(seeded_db, pillar="cracked_engineer", title="Archive M")
    done = core.create_task(
        seeded_db,
        pillar="cracked_engineer",
        milestone=milestone["id"],
        title="finished task",
    )
    todo = core.create_task(seeded_db, pillar="cracked_engineer", title="open task")
    archived = core.create_task(seeded_db, pillar="cracked_engineer", title="discarded task")

    core.log_session(seeded_db, done["id"], 25, started_at="2026-06-20T08:00:00+00:00")
    core.log_session(seeded_db, done["id"], 15, started_at="2026-06-20T09:00:00+00:00")
    core.set_task_status(seeded_db, todo["id"], "todo")
    core.set_task_status(seeded_db, archived["id"], "archived")
    frozen_clock.set("2026-06-21T10:00:00+00:00")
    core.set_task_status(seeded_db, done["id"], "done")

    rows = core.list_archived_tasks(seeded_db)

    assert [r["title"] for r in rows] == ["finished task"]
    assert rows[0]["actual_duration_min"] == 40
    assert rows[0]["pillar_name"] == "Cracked Engineer"
    assert rows[0]["milestone_title"] == "Archive M"
    assert rows[0]["completed_at"] == "2026-06-21T10:00:00+00:00"


def test_archive_filters_by_pillar_and_completed_range(seeded_db, frozen_clock):
    first = core.create_task(seeded_db, pillar="cracked_engineer", title="first")
    second = core.create_task(seeded_db, pillar="body_temple", title="second")

    frozen_clock.set("2026-06-20T10:00:00+00:00")
    core.set_task_status(seeded_db, first["id"], "done")
    frozen_clock.set("2026-06-23T10:00:00+00:00")
    core.set_task_status(seeded_db, second["id"], "done")

    rows = core.list_archived_tasks(
        seeded_db,
        pillar="body_temple",
        completed_from="2026-06-22T00:00:00+00:00",
        completed_to="2026-06-24T00:00:00+00:00",
    )

    assert [r["title"] for r in rows] == ["second"]
