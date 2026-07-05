"""Morning brief assembles all sections and triggers the sweep."""

from secondbrain import core


def test_brief_has_all_sections(seeded_db, frozen_clock):
    brief = core.get_today_brief(seeded_db)
    for key in ("date", "blocks", "external_events", "due_today", "overdue",
                "in_progress", "unconfirmed_blocks", "week_pillar_minutes"):
        assert key in brief
    assert len(brief["week_pillar_minutes"]) == 7  # one row per pillar


def test_brief_runs_sweep(seeded_db, frozen_clock):
    t = core.create_task(seeded_db, pillar="skills", title="x")
    core.create_time_block(
        seeded_db, t["id"], "2026-06-20T07:00:00+00:00", "2026-06-20T08:00:00+00:00"
    )
    # Pulling the brief flips the past block + logs its session.
    core.get_today_brief(seeded_db)
    s = seeded_db.execute("SELECT COUNT(*) FROM sessions WHERE source='block'").fetchone()[0]
    assert s == 1


def test_brief_surfaces_due_and_overdue(seeded_db, frozen_clock):
    core.create_task(seeded_db, pillar="energy", title="due", due_date="2026-06-20")
    core.create_task(seeded_db, pillar="energy", title="late", due_date="2026-06-18")
    brief = core.get_today_brief(seeded_db)
    assert any(t["title"] == "due" for t in brief["due_today"])
    assert any(t["title"] == "late" for t in brief["overdue"])
