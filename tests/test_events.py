"""External-events range read (overlap semantics)."""

from secondbrain import clock, core


def _add_event(conn, ext_id, start, end, title="meeting"):
    with conn:
        conn.execute(
            """
            INSERT INTO external_events (provider, external_id, title, start_at, end_at, last_synced)
            VALUES ('google', ?, ?, ?, ?, ?)
            """,
            (ext_id, title, start, end, clock.now_utc_iso()),
        )


def test_overlap_includes_spanning_event(seeded_db):
    _add_event(seeded_db, "e1", "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00")
    rows = core.list_external_events(
        seeded_db, "2026-06-20T09:30:00+00:00", "2026-06-20T11:00:00+00:00"
    )
    assert [r["external_id"] for r in rows] == ["e1"]


def test_outside_window_excluded(seeded_db):
    _add_event(seeded_db, "e1", "2026-06-20T06:00:00+00:00", "2026-06-20T07:00:00+00:00")
    rows = core.list_external_events(
        seeded_db, "2026-06-20T09:00:00+00:00", "2026-06-20T10:00:00+00:00"
    )
    assert rows == []


def test_empty_range(seeded_db):
    assert core.list_external_events(seeded_db, "2026-06-20", "2026-06-21") == []


def test_upsert_inserts_then_updates(seeded_db):
    r1 = core.upsert_external_events(seeded_db, [
        {"provider": "google", "external_id": "x", "title": "v1",
         "start_at": "2026-06-20T09:00:00+00:00", "end_at": "2026-06-20T10:00:00+00:00"},
    ])
    assert r1 == {"inserted": 1, "updated": 0}
    r2 = core.upsert_external_events(seeded_db, [
        {"provider": "google", "external_id": "x", "title": "v2",
         "start_at": "2026-06-20T09:00:00+00:00", "end_at": "2026-06-20T10:30:00+00:00"},
    ])
    assert r2 == {"inserted": 0, "updated": 1}
    rows = core.list_external_events(seeded_db, "2026-06-20", "2026-06-21")
    assert len(rows) == 1 and rows[0]["title"] == "v2"
