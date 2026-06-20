"""Shared fixtures.

A file-based temp DB (not :memory:) so the read-only mode=ro connection used by
query() can reopen the same file. All fixtures bind to one path via the
SECONDBRAIN_DB env override.
"""

from __future__ import annotations

import sqlite3

import pytest

from secondbrain import clock, config
from secondbrain.db.connection import connect
from secondbrain.db.init_db import init_db
from secondbrain.db import runtime
from secondbrain.seed import seed_pillars


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "test.sqlite"
    monkeypatch.setenv(config.ENV_DB_PATH, str(path))
    runtime.reset_conn()
    yield path
    runtime.reset_conn()


@pytest.fixture
def db(db_path) -> sqlite3.Connection:
    conn = connect(db_path)
    init_db(conn)
    yield conn
    conn.close()


@pytest.fixture
def seeded_db(db) -> sqlite3.Connection:
    seed_pillars(db)
    return db


@pytest.fixture
def frozen_clock(monkeypatch):
    """Pin the wall clock. Call set('2026-06-20T09:00:00+00:00') to move it."""
    state = {"now": "2026-06-20T09:00:00+00:00"}

    def fake_now_utc():
        return clock.parse_iso(state["now"])

    def fake_now_iso():
        return state["now"]

    monkeypatch.setattr(clock, "now_utc", fake_now_utc)
    monkeypatch.setattr(clock, "now_utc_iso", fake_now_iso)

    class Ctl:
        def set(self, iso: str):
            state["now"] = iso

    return Ctl()


@pytest.fixture
def api_client(db_path):
    """FastAPI TestClient bound to the temp DB."""
    from fastapi.testclient import TestClient
    from secondbrain.api.app import app

    runtime.reset_conn()
    with TestClient(app) as client:
        yield client
    runtime.reset_conn()
