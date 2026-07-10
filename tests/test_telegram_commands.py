from __future__ import annotations

from secondbrain.telegram import commands


def test_add_default_pillar(seeded_db):
    reply = commands.cmd_add(seeded_db, "Write report")
    assert reply.startswith("created task #")
    assert "Write report" in reply


def test_add_explicit_pillar(seeded_db):
    from secondbrain import core

    pillar_slug = core.get_pillars(seeded_db)[0]["slug"]
    reply = commands.cmd_add(seeded_db, f"{pillar_slug} | Buy milk")
    assert reply.startswith("created task #")
    assert "Buy milk" in reply


def test_add_empty_title(seeded_db):
    reply = commands.cmd_add(seeded_db, "   ")
    assert "usage" in reply


def test_list_empty(seeded_db):
    reply = commands.cmd_list(seeded_db, "")
    assert reply == "no open tasks"


def test_list_shows_created_task(seeded_db):
    commands.cmd_add(seeded_db, "Write report")
    reply = commands.cmd_list(seeded_db, "")
    assert "Write report" in reply


def test_done_marks_task(seeded_db):
    add_reply = commands.cmd_add(seeded_db, "Write report")
    task_id = add_reply.split("#")[1].split(":")[0]
    reply = commands.cmd_done(seeded_db, task_id)
    assert reply.startswith("done: #")

    list_reply = commands.cmd_list(seeded_db, "")
    assert "Write report" not in list_reply


def test_done_bad_id(seeded_db):
    reply = commands.cmd_done(seeded_db, "not-a-number")
    assert "usage" in reply


def test_done_nonexistent_id(seeded_db):
    reply = commands.cmd_done(seeded_db, "99999")
    assert "couldn't mark done" in reply


def test_help(seeded_db):
    reply = commands.cmd_help(seeded_db, "")
    assert "/add" in reply
