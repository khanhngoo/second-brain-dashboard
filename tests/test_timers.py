"""Server-managed timers: duration from elapsed, source by mode, one-per-task."""

from secondbrain import core


def test_start_stop_logs_elapsed(seeded_db, frozen_clock):
    t = core.create_task(seeded_db, pillar="body_temple", title="t", timer_mode="manual")
    frozen_clock.set("2026-06-20T09:00:00+00:00")
    core.start_timer(seeded_db, t["id"])
    frozen_clock.set("2026-06-20T09:40:00+00:00")
    res = core.stop_timer(seeded_db, t["id"])
    assert res["session"]["duration_min"] == 40
    assert res["session"]["source"] == "manual"
    assert res["status_changed"] is False
    assert core.get_task(seeded_db, t["id"])["status"] == "todo"
    # timer row gone
    assert seeded_db.execute("SELECT COUNT(*) FROM timers WHERE task_id=?", (t["id"],)).fetchone()[0] == 0


def test_stop_with_mark_done(seeded_db, frozen_clock):
    t = core.create_task(seeded_db, pillar="body_temple", title="t")
    core.start_timer(seeded_db, t["id"])
    frozen_clock.set("2026-06-20T09:10:00+00:00")
    res = core.stop_timer(seeded_db, t["id"], mark_done=True)
    assert res["status_changed"] is True
    assert core.get_task(seeded_db, t["id"])["status"] == "done"


def test_pomodoro_source(seeded_db, frozen_clock):
    t = core.create_task(seeded_db, pillar="body_temple", title="t", timer_mode="pomodoro")
    core.start_timer(seeded_db, t["id"])
    frozen_clock.set("2026-06-20T09:25:00+00:00")
    res = core.stop_timer(seeded_db, t["id"])
    assert res["session"]["source"] == "pomodoro"


def test_one_timer_per_task(seeded_db, frozen_clock):
    t = core.create_task(seeded_db, pillar="body_temple", title="t")
    core.start_timer(seeded_db, t["id"], mode="manual")
    core.start_timer(seeded_db, t["id"], mode="pomodoro")  # restart, not duplicate
    n = seeded_db.execute("SELECT COUNT(*) FROM timers WHERE task_id=?", (t["id"],)).fetchone()[0]
    assert n == 1
