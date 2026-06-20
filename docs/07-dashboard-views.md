# 07 — Dashboard Views

The dashboard is the glanceable client. Each view is fed by a specific MCP/HTTP tool from `03` so there is no bespoke query logic in the frontend. Every view is read-mostly, with the interactions noted.

## 1. Today / Morning Brief (landing view)

The default screen. Fed by `get_today_brief()`.

Shows: today's time blocks laid against today's external calendar events; due-today and overdue tasks; in-progress tasks; yesterday's auto-logged blocks awaiting confirm/skip; a compact per-pillar minutes-this-week strip.

Interactions: confirm or skip yesterday's blocks (`confirm_blocks` / `mark_block_skipped`); start a task's timer (Path 2/3 in `04`); jump to schedule a task.

## 2. Kanban

Fed by `get_kanban(pillar?)`. Columns map to status: **To Do / Doing / Done** (optionally a Backlog). Filterable by pillar.

Interactions: drag a card between columns → `set_task_status`; reorder within a column → `update_task` sort_order. Cards show pillar color, due date, estimated duration, subtask progress.

## 3. Eisenhower Matrix

Fed by `get_eisenhower(pillar?)`. Four quadrants from `is_urgent` × `is_important`:

- Urgent + Important — do now
- Not urgent + Important — schedule
- Urgent + Not important — delegate/minimize
- Neither — drop

Interactions: drag a task into a quadrant → `update_task(is_urgent, is_important)`. From "schedule" quadrant, a task can be dragged straight to the Calendar view.

## 4. Calendar / Time-Blocking

A day/week grid showing external events (read-only, from `external_events`) and owned time blocks.

Interactions:
- Drag an **unfinished task** from a side panel into a time slot → `create_time_block(task_id, start, end)` → pushes to the connected calendar (`05`).
- Drag/resize an existing block → `move_time_block`.
- Remove a block → `delete_time_block`.

This is the bridge between "tasks at hand" and the schedule. Resizing a block changes its planned duration (and thus the session it will auto-log per `04`).

## 5. Pillar Analytics

Fed by `get_pillar_time(bucket, range)`. Renders **time spent per pillar** with a bucket selector for **day / week / month / year**. Three renderings of the same aggregation:

- **Bar chart** — minutes per pillar in the selected period.
- **Donut/circle** — share of total time across the five pillars.
- **Heatmap** — calendar-style intensity (e.g. per-day minutes), optionally filtered to one pillar.

All driven off `sessions` summed by pillar (`02`). No balance/neglect nudges in v1 — display only.

## 6. Milestone Progress

Per pillar, list milestones with a **progress bar** = `done_tasks / total_tasks` (count-based, `v_milestone_progress`). Fed by `list_milestones(pillar?)` / `get_pillar(slug)`. Expanding a milestone shows its tasks and their subtask progress.

## Navigation

A pillar switcher (the five pillars, each with its color) filters Kanban, Eisenhower, Analytics, and Milestones to one pillar or "all." The Today view is always cross-pillar.

## Frontend principle

The frontend never composes raw SQL or reaches into the DB. It calls the same tool functions Claude Code uses (via the local HTTP API that wraps them — see `03`), so the two clients can't drift.
