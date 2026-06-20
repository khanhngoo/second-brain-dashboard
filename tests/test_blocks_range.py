"""Time-block range read (overlap, all statuses, ordering)."""

from secondbrain import core


def test_range_overlap_and_ordering(seeded_db):
    t = core.create_task(seeded_db, pillar="cracked_engineer", title="t")
    b1 = core.create_time_block(seeded_db, t["id"], "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00")
    b2 = core.create_time_block(seeded_db, t["id"], "2026-06-20T11:00:00+00:00", "2026-06-20T12:00:00+00:00")
    # outside the queried window
    core.create_time_block(seeded_db, t["id"], "2026-06-21T09:00:00+00:00", "2026-06-21T10:00:00+00:00")

    rows = core.list_blocks_range(seeded_db, "2026-06-20T00:00:00+00:00", "2026-06-20T23:59:00+00:00")
    assert [r["id"] for r in rows] == [b1["id"], b2["id"]]


def test_range_includes_done_and_skipped(seeded_db, frozen_clock):
    t = core.create_task(seeded_db, pillar="cracked_engineer", title="t")
    b = core.create_time_block(seeded_db, t["id"], "2026-06-20T07:00:00+00:00", "2026-06-20T08:00:00+00:00")
    core.run_autolog_sweep(seeded_db)  # flips to done
    core.mark_block_skipped(seeded_db, b["id"])  # -> skipped
    rows = core.list_blocks_range(seeded_db, "2026-06-20T00:00:00+00:00", "2026-06-20T23:59:00+00:00")
    assert rows[0]["status"] == "skipped"
