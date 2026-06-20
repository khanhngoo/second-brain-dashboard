"""The push seam: blocks call the provider, persist the event id, and survive
provider failures (local block is the source of truth). With NO provider, behavior
is identical to P2 (proves additivity)."""

import pytest

from secondbrain import core
from secondbrain.calendar.base import CalendarProvider


class MockProvider(CalendarProvider):
    def __init__(self, fail=False):
        self.fail = fail
        self.calls = []

    def push_event(self, *, title, start_at, end_at):
        self.calls.append(("push", title, start_at, end_at))
        if self.fail:
            raise RuntimeError("network down")
        return "ext-123"

    def update_event(self, event_id, *, start_at, end_at):
        self.calls.append(("update", event_id, start_at, end_at))
        if self.fail:
            raise RuntimeError("network down")

    def delete_event(self, event_id):
        self.calls.append(("delete", event_id))
        if self.fail:
            raise RuntimeError("network down")

    def list_events(self, *, start, end):
        return []


def _task(conn):
    return core.create_task(conn, pillar="cracked_engineer", title="deep work")


def test_no_provider_behaves_like_p2(seeded_db):
    """Default (no provider registered) — no calendar columns set, no outbox."""
    t = _task(seeded_db)
    b = core.create_time_block(seeded_db, t["id"], "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00")
    assert b["calendar_event_id"] is None
    assert seeded_db.execute("SELECT COUNT(*) FROM calendar_outbox").fetchone()[0] == 0


def test_create_pushes_and_persists_event_id(seeded_db):
    t = _task(seeded_db)
    p = MockProvider()
    b = core.create_time_block(
        seeded_db, t["id"], "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00", provider=p
    )
    assert b["calendar_event_id"] == "ext-123"
    assert b["calendar_provider"] == "google"
    assert p.calls[0][0] == "push"
    # title carries the owned prefix
    assert p.calls[0][1].startswith("[SB] ")


def test_move_calls_update(seeded_db):
    t = _task(seeded_db)
    p = MockProvider()
    b = core.create_time_block(seeded_db, t["id"], "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00", provider=p)
    core.move_time_block(seeded_db, b["id"], "2026-06-20T11:00:00+00:00", "2026-06-20T12:00:00+00:00", provider=p)
    assert any(c[0] == "update" and c[1] == "ext-123" for c in p.calls)


def test_delete_calls_delete(seeded_db):
    t = _task(seeded_db)
    p = MockProvider()
    b = core.create_time_block(seeded_db, t["id"], "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00", provider=p)
    core.delete_time_block(seeded_db, b["id"], provider=p)
    assert any(c[0] == "delete" and c[1] == "ext-123" for c in p.calls)


def test_push_failure_persists_block_and_enqueues(seeded_db):
    t = _task(seeded_db)
    p = MockProvider(fail=True)
    b = core.create_time_block(
        seeded_db, t["id"], "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00", provider=p
    )
    # Block persisted locally despite the push failing — no exception escaped.
    assert b["id"] is not None
    assert b["calendar_event_id"] is None
    rows = seeded_db.execute("SELECT * FROM calendar_outbox").fetchall()
    assert len(rows) == 1 and rows[0]["op"] == "create"


def test_outbox_flush_drains_on_success(seeded_db):
    t = _task(seeded_db)
    failing = MockProvider(fail=True)
    core.create_time_block(seeded_db, t["id"], "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00", provider=failing)
    assert seeded_db.execute("SELECT COUNT(*) FROM calendar_outbox").fetchone()[0] == 1

    healthy = MockProvider()
    result = core.flush_calendar_outbox(seeded_db, provider=healthy)
    assert result["flushed"] == 1 and result["remaining"] == 0
    assert any(c[0] == "push" for c in healthy.calls)
