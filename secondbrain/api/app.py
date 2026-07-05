"""FastAPI front door.

One route per core function, wrapping the SAME core calls the MCP server uses
(docs/03 §Backend/API parity). Pydantic bodies mirror core kwargs; the shared
exception handler maps domain errors to HTTP status codes.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from .. import config, core
from ..db.runtime import get_conn
from ..errors import NotFoundError, ReadOnlyViolation, ValidationError

app = FastAPI(title="Second Brain API")


def _conn():
    return get_conn()


@app.exception_handler(ValidationError)
async def _validation(_: Request, exc: ValidationError):
    return JSONResponse(status_code=422, content={"error": str(exc)})


@app.exception_handler(NotFoundError)
async def _notfound(_: Request, exc: NotFoundError):
    return JSONResponse(status_code=404, content={"error": str(exc)})


@app.exception_handler(ReadOnlyViolation)
async def _readonly(_: Request, exc: ReadOnlyViolation):
    return JSONResponse(status_code=400, content={"error": str(exc)})


# --- Request bodies -------------------------------------------------------

class CreateTaskBody(BaseModel):
    pillar: str | int
    title: str
    milestone: int | None = None
    description: str | None = None
    is_impact: bool = False
    is_effort: bool = False
    due_date: str | None = None
    note_ref: str | None = None


class UpdateFieldsBody(BaseModel):
    fields: dict


class StatusBody(BaseModel):
    status: str


class CreateMilestoneBody(BaseModel):
    title: str
    description: str | None = None
    target_date: str | None = None


class SubtaskBody(BaseModel):
    title: str


class LogSessionBody(BaseModel):
    task_id: int
    duration_min: int
    source: str = "manual"
    started_at: str | None = None
    ended_at: str | None = None
    note: str | None = None


class ReplaceSessionsBody(BaseModel):
    duration_min: int
    source: str = "manual"
    note: str | None = None


class TimeBlockBody(BaseModel):
    task_id: int
    start_at: str
    end_at: str


class MoveBlockBody(BaseModel):
    start_at: str
    end_at: str


class ConfirmBody(BaseModel):
    date: str


class QueryBody(BaseModel):
    sql: str


# --- Reads ----------------------------------------------------------------

@app.get("/today_brief")
def today_brief(date: str | None = None):
    return core.get_today_brief(_conn(), date)


@app.get("/pillars")
def pillars():
    return core.get_pillars(_conn())


@app.get("/pillars/{slug}")
def pillar(slug: str):
    return core.get_pillar(_conn(), slug)


@app.get("/milestones")
def milestones(status: str | None = None):
    return core.list_milestones(_conn(), status)


@app.get("/tasks")
def tasks(
    pillar: str | None = None,
    milestone: int | None = None,
    status: str | None = None,
    quadrant: str | None = None,
    due_before: str | None = None,
    limit: int | None = None,
):
    return core.list_tasks(_conn(), pillar, milestone, status, quadrant, due_before, limit)


@app.get("/archive/tasks")
def archive_tasks(
    pillar: str | None = None,
    completed_from: str | None = None,
    completed_to: str | None = None,
):
    return core.list_archived_tasks(_conn(), pillar, completed_from, completed_to)


@app.get("/tasks/{id}")
def task(id: int):
    return core.get_task(_conn(), id)


@app.get("/kanban")
def kanban(pillar: str | None = None):
    return core.get_kanban(_conn(), pillar)


@app.get("/impact-effort")
def impact_effort(pillar: str | None = None):
    return core.get_impact_effort(_conn(), pillar)


@app.get("/pillar_time")
def pillar_time(bucket: str, start: str | None = None, end: str | None = None):
    return core.get_pillar_time(_conn(), bucket, start, end)


@app.get("/external_events")
def external_events(start: str, end: str):
    return core.list_external_events(_conn(), start, end)


@app.get("/time_blocks")
def time_blocks(start: str, end: str):
    return core.list_blocks_range(_conn(), start, end)


# --- Writes ---------------------------------------------------------------

@app.post("/tasks")
def create_task(body: CreateTaskBody):
    return core.create_task(_conn(), **body.model_dump())


@app.patch("/tasks/{id}")
def update_task(id: int, body: UpdateFieldsBody):
    return core.update_task(_conn(), id, **body.fields)


@app.post("/tasks/{id}/status")
def set_task_status(id: int, body: StatusBody):
    return core.set_task_status(_conn(), id, body.status)


@app.post("/milestones")
def create_milestone(body: CreateMilestoneBody):
    return core.create_milestone(_conn(), **body.model_dump())


@app.patch("/milestones/{id}")
def update_milestone(id: int, body: UpdateFieldsBody):
    return core.update_milestone(_conn(), id, **body.fields)


@app.delete("/milestones/{id}", status_code=204)
def delete_milestone(id: int):
    core.delete_milestone(_conn(), id)


@app.post("/tasks/{task_id}/subtasks")
def add_subtask(task_id: int, body: SubtaskBody):
    return core.add_subtask(_conn(), task_id, body.title)


@app.post("/subtasks/{id}/toggle")
def toggle_subtask(id: int):
    return core.toggle_subtask(_conn(), id)


@app.post("/sessions")
def log_session(body: LogSessionBody):
    return core.log_session(
        _conn(), body.task_id, body.duration_min, body.source,
        body.started_at, body.ended_at, body.note,
    )


@app.patch("/tasks/{id}/sessions")
def replace_sessions(id: int, body: ReplaceSessionsBody):
    return core.replace_sessions(_conn(), id, body.duration_min, body.source, body.note)


@app.post("/time_blocks")
def create_time_block(body: TimeBlockBody):
    return core.create_time_block(_conn(), body.task_id, body.start_at, body.end_at)


@app.patch("/time_blocks/{id}")
def move_time_block(id: int, body: MoveBlockBody):
    return core.move_time_block(_conn(), id, body.start_at, body.end_at)


@app.delete("/time_blocks/{id}")
def delete_time_block(id: int):
    return core.delete_time_block(_conn(), id)


@app.post("/blocks/confirm")
def confirm_blocks(body: ConfirmBody):
    return core.confirm_blocks(_conn(), body.date)


@app.post("/time_blocks/{id}/skip")
def mark_block_skipped(id: int):
    return core.mark_block_skipped(_conn(), id)


@app.post("/query")
def query(body: QueryBody):
    return core.query(body.sql, config.db_path())


# --- Calendar (P3) --------------------------------------------------------

class SyncBody(BaseModel):
    start: str | None = None
    end: str | None = None


@app.get("/calendar/status")
def calendar_status():
    return core.calendar_status(_conn())


@app.post("/calendar/sync")
def calendar_sync(body: SyncBody):
    from datetime import timedelta
    from .. import clock

    # Default to a one-week window around today if no range is given.
    start = body.start or (clock.now_utc() - timedelta(days=1)).isoformat()
    end = body.end or (clock.now_utc() + timedelta(days=7)).isoformat()
    return core.run_calendar_sync(_conn(), start, end)


@app.post("/calendar/connect")
def calendar_connect():
    # The OAuth consent flow opens a browser and must run from the CLI
    # (`sb calendar connect`), not a headless API process.
    return JSONResponse(
        status_code=400,
        content={"error": "Run `sb calendar connect` to authorize a Google account."},
    )
