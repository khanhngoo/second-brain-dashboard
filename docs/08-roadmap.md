# 08 — Roadmap

Build in phases so the core daily value ("what do I start with today") arrives early, before the harder integrations.

## P0 — Foundation

- SQLite schema from `02` (tables + derived views).
- The MCP server from `03`: the read tools, the write tools for tasks/milestones/subtasks/status, `log_session`, and the read-only `query(sql)` escape hatch.
- A CLI or quick harness to seed the five pillars and a few milestones/tasks.
- The local HTTP API wrapping the same functions (so the dashboard can come next).

**Done when:** Claude Code can create/list/update tasks and milestones, log sessions, and pull `get_today_brief()` — entirely from the command line.

## P1 — Glanceable dashboard (the core loop)

- Today / Morning Brief view (`07` §1).
- Kanban (`07` §2).
- Pillar Analytics — start with **task counts**, then add **time** once sessions exist (`07` §5).
- Milestone progress bars (`07` §6).

**Done when:** the user opens the dashboard in the morning and immediately sees what to do, and Claude Code can drive it. This phase already delivers the product's main value.

## P2 — Scheduling & full time tracking

- Eisenhower matrix (`07` §3).
- Calendar / time-blocking grid with drag-to-schedule, **local only** for now (no external sync yet) (`07` §4).
- The three logging paths in full (`04`): calendar-block auto-log (reversible), pomodoro timer, manual timer with Stop/Done.

**Done when:** the user can drag tasks into local time blocks, run timers, and watch pillar time accumulate accurately.

## P3 — Calendar sync

- Push-plus-read with Google, then Outlook (`05`): read external events into the day view; push/move/delete owned blocks.
- OAuth + token storage in the keychain.

**Done when:** scheduled blocks appear in Google/Outlook and existing meetings appear in the dashboard's day view.

## Cross-cutting (land when convenient, not blocking)

- **Notes integration** (`06`): LightRAG over Obsidian + `notes_search`, and `note_ref` cross-links. The morning brief works without this, so slot it in after P1/P2.
- **Markdown export** of the structured data (optional, one-directional) if the user wants human-browsable/git-backed copies.

## Deferred (post-v1)

- Two-way calendar sync.
- Time-weighted milestone progress.
- Balance/neglect reminders.
- Mobile / multi-device.
