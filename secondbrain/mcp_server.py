"""FastMCP front door.

One @mcp.tool per core function. Each body is a single delegating call into
``core`` (zero logic here — the parity rule, docs/03). Tool name == core fn
name == HTTP route.
"""

from __future__ import annotations

from fastmcp import FastMCP

from . import config, core
from .db.runtime import get_conn

mcp = FastMCP("secondbrain")


def _conn():
    return get_conn()


# --- Reads ----------------------------------------------------------------

@mcp.tool()
def get_today_brief(date: str | None = None) -> dict:
    return core.get_today_brief(_conn(), date)


@mcp.tool()
def get_pillars() -> list[dict]:
    return core.get_pillars(_conn())


@mcp.tool()
def get_pillar(slug: str) -> dict:
    return core.get_pillar(_conn(), slug)


@mcp.tool()
def list_milestones(pillar: str | int | None = None, status: str | None = None) -> list[dict]:
    return core.list_milestones(_conn(), pillar, status)


@mcp.tool()
def list_tasks(
    pillar: str | int | None = None,
    milestone: int | None = None,
    status: str | None = None,
    quadrant: str | None = None,
    due_before: str | None = None,
    limit: int | None = None,
) -> list[dict]:
    return core.list_tasks(_conn(), pillar, milestone, status, quadrant, due_before, limit)


@mcp.tool()
def get_task(id: int) -> dict:
    return core.get_task(_conn(), id)


@mcp.tool()
def get_kanban(pillar: str | int | None = None) -> dict:
    return core.get_kanban(_conn(), pillar)


@mcp.tool()
def get_eisenhower(pillar: str | int | None = None) -> dict:
    return core.get_eisenhower(_conn(), pillar)


@mcp.tool()
def get_pillar_time(bucket: str, start: str | None = None, end: str | None = None) -> list[dict]:
    return core.get_pillar_time(_conn(), bucket, start, end)


@mcp.tool()
def list_external_events(start: str, end: str) -> list[dict]:
    return core.list_external_events(_conn(), start, end)


@mcp.tool()
def list_time_blocks(start: str, end: str) -> list[dict]:
    return core.list_blocks_range(_conn(), start, end)


# --- Writes: tasks & hierarchy --------------------------------------------

@mcp.tool()
def create_task(
    pillar: str | int,
    title: str,
    milestone: int | None = None,
    description: str | None = None,
    is_urgent: bool = False,
    is_important: bool = False,
    estimated_duration_min: int | None = None,
    timer_mode: str | None = None,
    due_date: str | None = None,
    note_ref: str | None = None,
) -> dict:
    return core.create_task(
        _conn(), pillar=pillar, title=title, milestone=milestone, description=description,
        is_urgent=is_urgent, is_important=is_important,
        estimated_duration_min=estimated_duration_min, timer_mode=timer_mode,
        due_date=due_date, note_ref=note_ref,
    )


@mcp.tool()
def update_task(id: int, fields: dict) -> dict:
    return core.update_task(_conn(), id, **fields)


@mcp.tool()
def set_task_status(id: int, status: str) -> dict:
    return core.set_task_status(_conn(), id, status)


@mcp.tool()
def create_milestone(
    pillar: str | int,
    title: str,
    description: str | None = None,
    target_date: str | None = None,
) -> dict:
    return core.create_milestone(
        _conn(), pillar=pillar, title=title, description=description, target_date=target_date
    )


@mcp.tool()
def update_milestone(id: int, fields: dict) -> dict:
    return core.update_milestone(_conn(), id, **fields)


@mcp.tool()
def add_subtask(task_id: int, title: str) -> dict:
    return core.add_subtask(_conn(), task_id, title)


@mcp.tool()
def toggle_subtask(id: int) -> dict:
    return core.toggle_subtask(_conn(), id)


# --- Writes: time ---------------------------------------------------------

@mcp.tool()
def log_session(
    task_id: int,
    duration_min: int,
    source: str = "manual",
    started_at: str | None = None,
    ended_at: str | None = None,
    note: str | None = None,
) -> dict:
    return core.log_session(_conn(), task_id, duration_min, source, started_at, ended_at, note)


@mcp.tool()
def start_timer(task_id: int, mode: str | None = None) -> dict:
    return core.start_timer(_conn(), task_id, mode)


@mcp.tool()
def stop_timer(task_id: int, mark_done: bool = False) -> dict:
    return core.stop_timer(_conn(), task_id, mark_done)


# --- Writes: scheduling ---------------------------------------------------

@mcp.tool()
def create_time_block(task_id: int, start_at: str, end_at: str) -> dict:
    return core.create_time_block(_conn(), task_id, start_at, end_at)


@mcp.tool()
def move_time_block(id: int, start_at: str, end_at: str) -> dict:
    return core.move_time_block(_conn(), id, start_at, end_at)


@mcp.tool()
def delete_time_block(id: int) -> dict:
    return core.delete_time_block(_conn(), id)


@mcp.tool()
def confirm_blocks(date: str) -> dict:
    return core.confirm_blocks(_conn(), date)


@mcp.tool()
def mark_block_skipped(id: int) -> dict:
    return core.mark_block_skipped(_conn(), id)


# --- Escape hatch ---------------------------------------------------------

@mcp.tool()
def query(sql: str) -> dict:
    """Read-only SELECT against the tables/views in docs/02."""
    return core.query(sql, config.db_path())


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
