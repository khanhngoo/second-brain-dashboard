"""The core layer — the single implementation behind every front door.

MCP tools, HTTP routes, and the CLI all import from here. Every public name
below maps 1:1 to a tool in docs/03.
"""

from __future__ import annotations

from .analytics import get_pillar_time
from .blocks import (
    confirm_blocks,
    create_time_block,
    delete_time_block,
    mark_block_skipped,
    move_time_block,
    run_autolog_sweep,
)
from .blocks import list_blocks_range
from .boards import get_impact_effort, get_kanban
from .brief import get_today_brief
from .calendar_accounts import (
    add_calendar_account,
    list_calendar_accounts,
    remove_calendar_account,
)
from .calsync import calendar_status, flush_calendar_outbox, run_calendar_sync
from .events import list_external_events, upsert_external_events
from .milestones import create_milestone, delete_milestone, list_milestones, update_milestone
from .pillars import get_pillar, get_pillars
from .rawquery import query
from .sessions import log_session, replace_sessions
from .subtasks import add_subtask, toggle_subtask
from .tasks import (
    create_task,
    get_task,
    list_archived_tasks,
    list_tasks,
    set_task_status,
    update_task,
)

__all__ = [
    # reads
    "get_today_brief",
    "get_pillars",
    "get_pillar",
    "list_milestones",
    "list_tasks",
    "list_archived_tasks",
    "get_task",
    "get_kanban",
    "get_impact_effort",
    "get_pillar_time",
    "list_external_events",
    "list_blocks_range",
    # writes — tasks & hierarchy
    "create_task",
    "update_task",
    "set_task_status",
    "create_milestone",
    "update_milestone",
    "delete_milestone",
    "add_subtask",
    "toggle_subtask",
    # writes — time
    "log_session",
    "replace_sessions",
    # writes — scheduling
    "create_time_block",
    "move_time_block",
    "delete_time_block",
    "confirm_blocks",
    "mark_block_skipped",
    "run_autolog_sweep",
    "upsert_external_events",
    # calendar (P3)
    "calendar_status",
    "run_calendar_sync",
    "flush_calendar_outbox",
    "add_calendar_account",
    "list_calendar_accounts",
    "remove_calendar_account",
    # escape hatch
    "query",
]
