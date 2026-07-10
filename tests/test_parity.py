"""MCP/HTTP parity: the same operation through both front doors returns
identical JSON. Fails the instant logic leaks into an adapter.

Each side gets its own temp DB, seeded identically, then the same sequence of
operations runs through it. Volatile fields (ids, timestamps) are normalized
before comparison since they differ run-to-run, not door-to-door.
"""

import json

import pytest

from secondbrain import config, core
from secondbrain.db import runtime
from secondbrain.db.connection import connect
from secondbrain.db.init_db import init_db
from secondbrain.seed import seed_pillars

VOLATILE = {"id", "created_at", "completed_at", "started_at", "ended_at",
            "milestone_id", "task_id", "pillar_id", "block_id", "date"}


def _normalize(obj):
    if isinstance(obj, dict):
        return {k: ("<v>" if k in VOLATILE else _normalize(v)) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_normalize(x) for x in obj]
    return obj


def _seed(path):
    conn = connect(path)
    init_db(conn)
    seed_pillars(conn)
    return conn


def _run_via_mcp(path):
    """Run the scripted ops directly through core (what every MCP tool delegates to)."""
    conn = connect(path)
    init_db(conn)
    seed_pillars(conn)
    m = core.create_milestone(conn, title="M")
    t = core.create_task(conn, pillar="skills", title="t", milestone=m["id"],
                         is_impact=True)
    core.set_task_status(conn, t["id"], "doing")
    core.log_session(conn, t["id"], 40, started_at="2026-06-20T08:00:00+00:00")
    out = {
        "create_task": t,
        "list_tasks": core.list_tasks(conn, pillar="skills"),
        "get_kanban": core.get_kanban(conn, "skills"),
        "get_today_brief": core.get_today_brief(conn, "2026-06-20"),
    }
    conn.close()
    return out


def _run_via_http(client):
    m = client.post("/milestones", json={"title": "M"}).json()
    t = client.post("/tasks", json={
        "pillar": "skills", "title": "t", "milestone": m["id"], "is_impact": True,
    }).json()
    client.post(f"/tasks/{t['id']}/status", json={"status": "doing"})
    client.post("/sessions", json={
        "task_id": t["id"], "duration_min": 40, "started_at": "2026-06-20T08:00:00+00:00",
    })
    return {
        "create_task": t,
        "list_tasks": client.get("/tasks", params={"pillar": "skills"}).json(),
        "get_kanban": client.get("/kanban", params={"pillar": "skills"}).json(),
        "get_today_brief": client.get("/today_brief", params={"date": "2026-06-20"}).json(),
    }


@pytest.mark.parametrize("key", ["create_task", "list_tasks", "get_kanban", "get_today_brief"])
def test_mcp_http_parity(tmp_path, monkeypatch, key):
    # HTTP side: dedicated DB via the shared runtime connection + TestClient.
    http_path = tmp_path / "http.sqlite"
    monkeypatch.setenv(config.ENV_DB_PATH, str(http_path))
    runtime.reset_conn()
    from fastapi.testclient import TestClient
    from secondbrain.api.app import app
    with TestClient(app) as client:
        # Ensure pillars exist on the runtime connection the API uses.
        seed_pillars(runtime.get_conn())
        http_out = _run_via_http(client)
    runtime.reset_conn()

    # MCP/core side: a separate DB, same script.
    mcp_path = tmp_path / "mcp.sqlite"
    mcp_out = _run_via_mcp(mcp_path)

    assert _normalize(mcp_out[key]) == _normalize(http_out[key]), (
        f"parity drift in {key}:\n"
        f"MCP: {json.dumps(_normalize(mcp_out[key]), indent=2)}\n"
        f"HTTP: {json.dumps(_normalize(http_out[key]), indent=2)}"
    )
