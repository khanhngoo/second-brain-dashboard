# 03 — Agentic Layer (MCP Server)

This is the **contract**. Claude Code, and the dashboard's backend, both operate through these tools. No client touches the database directly.

## Design rationale

- **Shaped reads for the common path.** The morning brief, pillar stats, and board state return exactly the summary needed — not raw rows. This is where token cost is actually saved: the server collapses several queries into one tight response so Claude Code doesn't read dozens of rows into context to assemble it.
- **One read-only SQL escape hatch for the long tail.** Ad-hoc questions ("evening focus across pillars in May") don't each deserve a bespoke tool. `query(sql)` covers them. Cost is the schema in context (small, loaded once) plus the rows back.
- **Writes are always tools, never raw SQL.** A stray `DELETE`/bad `WHERE` would corrupt the user's day. Every mutation goes through a validated tool. `query(sql)` is **read-only** and must reject anything that isn't a `SELECT` (run it on a read-only connection and additionally parse-guard).

## Read tools (shaped)

- `get_today_brief(date?)` → today's blocks + today's external events + due-today + overdue + in-progress tasks + yesterday's unconfirmed blocks + this-week per-pillar minutes. The centerpiece; see `01`.
- `get_pillars()` → the five pillars with rollup: active milestones, open tasks, minutes this week.
- `get_pillar(slug)` → one pillar with its milestones (and each milestone's progress %).
- `list_milestones(pillar?, status?)` → milestones with derived progress.
- `list_tasks(pillar?, milestone?, status?, quadrant?, due_before?, limit?)` → filtered task list, compact fields.
- `get_task(id)` → full task: subtasks, sessions summary (total minutes), blocks, note_ref.
- `get_kanban(pillar?)` → tasks grouped into columns (To Do / Doing / Done) in board order.
- `get_eisenhower(pillar?)` → tasks grouped into the four quadrants.
- `get_pillar_time(bucket, start?, end?)` → minutes per pillar for `bucket` ∈ {`day`,`week`,`month`,`year`}, over an optional range. Feeds bar/donut/heatmap.

## Write tools (validated)

Tasks & hierarchy:
- `create_task(pillar, title, milestone?, description?, is_urgent?, is_important?, estimated_duration_min?, timer_mode?, due_date?, note_ref?)`
- `update_task(id, ...fields)`
- `set_task_status(id, status)` — `todo`/`doing`/`done`/`archived`. Setting `done` stamps `completed_at` and rolls into milestone progress.
- `create_milestone(pillar, title, description?, target_date?)`, `update_milestone(id, ...)`
- `add_subtask(task_id, title)`, `toggle_subtask(id)`

Time:
- `log_session(task_id, duration_min, source?, started_at?, ended_at?, note?)` — manual/explicit log (source defaults to `manual`).
- `start_timer(task_id, mode?)` / `stop_timer(task_id, mark_done?)` — optional server-managed timer (the dashboard may also run timers in-UI and just call `log_session` on stop; see `04`). If `mark_done` is true, also sets status `done`.

Scheduling (these drive calendar push — see `05`):
- `create_time_block(task_id, start_at, end_at)` → creates the block and pushes an event to the connected calendar.
- `move_time_block(id, start_at, end_at)` → updates block + pushes the change.
- `delete_time_block(id)` → deletes block + removes the pushed event.
- `confirm_blocks(date)` → confirm yesterday's auto-logged blocks as done (no-op accept).
- `mark_block_skipped(id)` → set block `skipped` and **void its auto-created session**.

Notes (separate surface — see `06`):
- `notes_search(query, k?)` → semantic/graph retrieval over Obsidian via LightRAG. Returns note snippets + paths/links, **not** task data.

## Escape hatch

- `query(sql)` → **read-only** SELECT against the tables/views in `02`. Reject non-SELECT statements. Use this only when no shaped tool fits.

## Write-safety rules

1. Every write tool validates inputs (existence of FKs, enum membership, the pillar/milestone invariant from `02`).
2. No tool performs unbounded bulk deletes/updates. Destructive actions are per-id and explicit.
3. `query(sql)` cannot mutate; enforce via a read-only DB connection **and** a statement guard.
4. All write tools return the resulting object (or a compact confirmation) so Claude Code can verify without a follow-up read.

## Backend/API parity

The dashboard's local HTTP API should wrap the **same** underlying functions as these MCP tools — one implementation, two front doors (MCP for Claude Code, HTTP for the dashboard). This guarantees the two clients can never drift.
