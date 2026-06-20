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
from .boards import get_eisenhower, get_kanban
from .brief import get_today_brief
from .milestones import create_milestone, list_milestones, update_milestone
from .pillars import get_pillar, get_pillars
from .rawquery import query
from .sessions import log_session, start_timer, stop_timer
from .subtasks import add_subtask, toggle_subtask
from .tasks import (
    create_task,
    get_task,
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
    "get_task",
    "get_kanban",
    "get_eisenhower",
    "get_pillar_time",
    # writes — tasks & hierarchy
    "create_task",
    "update_task",
    "set_task_status",
    "create_milestone",
    "update_milestone",
    "add_subtask",
    "toggle_subtask",
    # writes — time
    "log_session",
    "start_timer",
    "stop_timer",
    # writes — scheduling
    "create_time_block",
    "move_time_block",
    "delete_time_block",
    "confirm_blocks",
    "mark_block_skipped",
    "run_autolog_sweep",
    # escape hatch
    "query",
]
