"""Command logic, kept as plain functions so tests don't need to mock Telegram.

Each function takes ``(conn, text)`` where ``text`` is everything after the
command name (already stripped), and returns the reply string. The bot module
wires these to python-telegram-bot handlers.
"""

from __future__ import annotations

import sqlite3

from .. import core
from ..errors import SecondBrainError

HELP_TEXT = (
    "Second Brain bot.\n\n"
    "/add <title> — create a task in your default pillar\n"
    "/add <pillar-slug> | <title> — create a task in a specific pillar\n"
    "/list — show open tasks\n"
    "/done <id> — mark a task done\n"
    "/help — show this message"
)


def _default_pillar_slug(conn: sqlite3.Connection) -> str | None:
    pillars = core.get_pillars(conn)
    return pillars[0]["slug"] if pillars else None


def cmd_add(conn: sqlite3.Connection, text: str) -> str:
    text = text.strip()
    if not text:
        return "usage: /add <title>  or  /add <pillar-slug> | <title>"

    if "|" in text:
        pillar_slug, _, title = text.partition("|")
        pillar_slug = pillar_slug.strip()
        title = title.strip()
    else:
        pillar_slug = _default_pillar_slug(conn)
        title = text

    if not pillar_slug:
        return "no pillars exist yet — seed the database first"
    if not title:
        return "usage: /add <title>  or  /add <pillar-slug> | <title>"

    try:
        task = core.create_task(conn, pillar=pillar_slug, title=title)
    except SecondBrainError as e:
        return f"couldn't create task: {e}"
    return f"created task #{task['id']}: {task['title']} ({pillar_slug})"


def cmd_list(conn: sqlite3.Connection, text: str) -> str:
    tasks = core.list_tasks(conn, status="todo")
    if not tasks:
        return "no open tasks"
    lines = [f"#{t['id']} {t['title']}" for t in tasks]
    return "\n".join(lines)


def cmd_done(conn: sqlite3.Connection, text: str) -> str:
    text = text.strip()
    if not text or not text.isdigit():
        return "usage: /done <id>"
    task_id = int(text)
    try:
        task = core.set_task_status(conn, task_id, "done")
    except SecondBrainError as e:
        return f"couldn't mark done: {e}"
    return f"done: #{task['id']} {task['title']}"


def cmd_help(conn: sqlite3.Connection, text: str) -> str:
    return HELP_TEXT
