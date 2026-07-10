from secondbrain import core


def test_archive_lists_done_tasks_with_actual_duration(seeded_db, frozen_clock):
    milestone = core.create_milestone(seeded_db, title="Archive M")
    done = core.create_task(
        seeded_db,
        pillar="skills",
        milestone=milestone["id"],
        title="finished task",
    )
    todo = core.create_task(seeded_db, pillar="skills", title="open task")
    archived = core.create_task(seeded_db, pillar="skills", title="discarded task")

    core.log_session(seeded_db, done["id"], 25, started_at="2026-06-20T08:00:00+00:00")
    core.log_session(seeded_db, done["id"], 15, started_at="2026-06-20T09:00:00+00:00")
    core.set_task_status(seeded_db, todo["id"], "todo")
    core.set_task_status(seeded_db, archived["id"], "archived")
    frozen_clock.set("2026-06-21T10:00:00+00:00")
    core.set_task_status(seeded_db, done["id"], "done")

    rows = core.list_archived_tasks(seeded_db)

    assert {r["title"] for r in rows} == {"finished task", "open task", "discarded task"}
    finished = next(r for r in rows if r["title"] == "finished task")
    assert finished["actual_duration_min"] == 40
    assert finished["pillar_name"] == "Skills"
    assert finished["milestone_title"] == "Archive M"
    assert finished["completed_at"] == "2026-06-21T10:00:00+00:00"
    assert next(r for r in rows if r["title"] == "discarded task")["completed_at"] is None
    assert next(r for r in rows if r["title"] == "open task")["completed_at"] is None


def test_archive_filters_by_pillar_and_completed_range(seeded_db, frozen_clock):
    first = core.create_task(seeded_db, pillar="skills", title="first")
    second = core.create_task(seeded_db, pillar="energy", title="second")

    frozen_clock.set("2026-06-20T10:00:00+00:00")
    core.set_task_status(seeded_db, first["id"], "done")
    frozen_clock.set("2026-06-23T10:00:00+00:00")
    core.set_task_status(seeded_db, second["id"], "done")

    rows = core.list_archived_tasks(
        seeded_db,
        pillar="energy",
        completed_from="2026-06-22T00:00:00+00:00",
        completed_to="2026-06-24T00:00:00+00:00",
    )

    assert [r["title"] for r in rows] == ["second"]
