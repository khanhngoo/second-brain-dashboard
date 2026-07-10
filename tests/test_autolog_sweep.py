"""Auto-log sweep + reversibility (skip voids the session) + confirm."""

from secondbrain import core


def _make_past_block(conn):
    t = core.create_task(conn, pillar="skills", title="deep work")
    # A 60-min block that ended in the past relative to frozen now (09:00).
    blk = core.create_time_block(
        conn, t["id"], "2026-06-20T07:00:00+00:00", "2026-06-20T08:00:00+00:00"
    )
    return t, blk


def test_sweep_logs_past_block(seeded_db, frozen_clock):
    t, blk = _make_past_block(seeded_db)
    core.run_autolog_sweep(seeded_db)
    block = seeded_db.execute(
        "SELECT * FROM time_blocks WHERE id = ?", (blk["id"],)
    ).fetchone()
    assert block["status"] == "done" and block["auto_logged"] == 1
    s = seeded_db.execute(
        "SELECT * FROM sessions WHERE block_id = ?", (blk["id"],)
    ).fetchone()
    assert s["source"] == "block" and s["duration_min"] == 60


def test_sweep_is_idempotent(seeded_db, frozen_clock):
    _make_past_block(seeded_db)
    core.run_autolog_sweep(seeded_db)
    core.run_autolog_sweep(seeded_db)
    n = seeded_db.execute("SELECT COUNT(*) FROM sessions WHERE source='block'").fetchone()[0]
    assert n == 1


def test_future_block_untouched(seeded_db, frozen_clock):
    t = core.create_task(seeded_db, pillar="skills", title="later")
    blk = core.create_time_block(
        seeded_db, t["id"], "2026-06-20T10:00:00+00:00", "2026-06-20T11:00:00+00:00"
    )
    core.run_autolog_sweep(seeded_db)
    block = seeded_db.execute("SELECT * FROM time_blocks WHERE id = ?", (blk["id"],)).fetchone()
    assert block["status"] == "planned"


def test_skip_voids_session_and_removes_pillar_minutes(seeded_db, frozen_clock):
    t, blk = _make_past_block(seeded_db)
    core.run_autolog_sweep(seeded_db)
    before = core.get_pillar_time(seeded_db, "day", "2026-06-20", "2026-06-20")
    mins_before = {r["slug"]: r["minutes"] for r in before}["skills"]
    assert mins_before == 60

    core.mark_block_skipped(seeded_db, blk["id"])
    block = seeded_db.execute("SELECT * FROM time_blocks WHERE id = ?", (blk["id"],)).fetchone()
    assert block["status"] == "skipped"
    after = core.get_pillar_time(seeded_db, "day", "2026-06-20", "2026-06-20")
    mins_after = {r["slug"]: r["minutes"] for r in after}["skills"]
    assert mins_after == 0


def test_confirm_blocks_clears_unconfirmed(seeded_db, frozen_clock):
    t, blk = _make_past_block(seeded_db)
    core.run_autolog_sweep(seeded_db)
    # brief on a later date surfaces yesterday's unconfirmed block...
    brief = core.get_today_brief(seeded_db, "2026-06-21")
    assert any(b["id"] == blk["id"] for b in brief["unconfirmed_blocks"])
    core.confirm_blocks(seeded_db, "2026-06-20")
    brief2 = core.get_today_brief(seeded_db, "2026-06-21")
    assert all(b["id"] != blk["id"] for b in brief2["unconfirmed_blocks"])
