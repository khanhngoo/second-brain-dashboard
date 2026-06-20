"""Read-sync: upsert idempotency, echo-loop exclusion, status reporting."""

import pytest

from secondbrain import core
from secondbrain.calendar import set_provider
from secondbrain.calendar.base import CalendarProvider, OWNED_PROPERTY


class ReadProvider(CalendarProvider):
    """Returns a fixed external-event list (already excludes owned by tag, like
    the real Google provider does)."""

    def __init__(self, events):
        self._events = events

    def push_event(self, *, title, start_at, end_at):
        return "pushed"

    def update_event(self, event_id, *, start_at, end_at):
        pass

    def delete_event(self, event_id):
        pass

    def list_events(self, *, start, end):
        return list(self._events)


@pytest.fixture
def provider_cleanup():
    yield
    set_provider(None)  # always reset the registry after a test touches it


def test_status_disabled_by_default(seeded_db):
    status = core.calendar_status(seeded_db)
    assert status["enabled"] is False
    assert status["accounts"] == []


def test_sync_noop_when_disabled(seeded_db):
    out = core.run_calendar_sync(seeded_db, "2026-06-20T00:00:00+00:00", "2026-06-20T23:59:00+00:00")
    assert out["read"]["synced"] is False


def test_sync_upserts_and_is_idempotent(seeded_db, provider_cleanup):
    ev = {
        "provider": "google", "external_id": "g1", "title": "Standup",
        "start_at": "2026-06-20T09:00:00+00:00", "end_at": "2026-06-20T09:30:00+00:00",
    }
    set_provider(ReadProvider([ev]))
    r1 = core.run_calendar_sync(seeded_db, "2026-06-20T00:00:00+00:00", "2026-06-20T23:59:00+00:00")
    assert r1["read"]["inserted"] == 1
    r2 = core.run_calendar_sync(seeded_db, "2026-06-20T00:00:00+00:00", "2026-06-20T23:59:00+00:00")
    assert r2["read"]["updated"] == 1 and r2["read"]["inserted"] == 0
    # one row, not two
    rows = core.list_external_events(seeded_db, "2026-06-20", "2026-06-21")
    assert len(rows) == 1 and rows[0]["title"] == "Standup"


def test_echo_loop_excludes_our_pushed_block(seeded_db, provider_cleanup):
    # Register a provider, push a block (gets calendar_event_id "ext-X")...
    class P(ReadProvider):
        def push_event(self, *, title, start_at, end_at):
            return "ext-X"

    p = P([
        {"provider": "google", "external_id": "ext-X", "title": "[SB] ours",
         "start_at": "2026-06-20T09:00:00+00:00", "end_at": "2026-06-20T10:00:00+00:00"},
        {"provider": "google", "external_id": "g2", "title": "real meeting",
         "start_at": "2026-06-20T11:00:00+00:00", "end_at": "2026-06-20T12:00:00+00:00"},
    ])
    set_provider(p)
    t = core.create_task(seeded_db, pillar="cracked_engineer", title="x")
    core.create_time_block(seeded_db, t["id"], "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00")

    core.run_calendar_sync(seeded_db, "2026-06-20T00:00:00+00:00", "2026-06-20T23:59:00+00:00")
    rows = core.list_external_events(seeded_db, "2026-06-20", "2026-06-21")
    # Our pushed event (ext-X) is filtered out; only the real meeting remains.
    assert [r["external_id"] for r in rows] == ["g2"]


def test_add_account_stores_ref_no_token(seeded_db):
    acc = core.add_calendar_account(seeded_db, "google", "me@example.com")
    assert acc["account_email"] == "me@example.com"
    # the accounts table has no token column — tokens live in the keychain
    cols = [r[1] for r in seeded_db.execute("PRAGMA table_info(calendar_accounts)").fetchall()]
    assert "token" not in cols and "sync_token" in cols
