# 02 — Data Model

SQLite is the single source of truth. All times are stored as UTC ISO-8601 (or unix epoch); render in the user's local timezone at the edge.

## The session-vs-status split (read this first)

Two independent facts:

- **Session** = an interval of minutes attributed to a task (and therefore to that task's pillar). Sessions are how *time spent* is recorded.
- **Status** = a task's lifecycle state: `todo` / `doing` / `done` / `archived`.

They do not depend on each other. A task can accumulate many sessions while still `todo`/`doing`; a task can be marked `done` with little or no logged time. Consequently:

- **Pillar time analytics** = `SUM(sessions.duration_min)` grouped by the session's task's pillar.
- **Milestone progress** = fraction of the milestone's tasks with `status = done`.

Keep these two queries entirely separate.

## Tables

### `pillars`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| slug | TEXT UNIQUE | e.g. `cracked_engineer` |
| name | TEXT | display name |
| description | TEXT | nullable |
| color | TEXT | hex, for visualizations |
| sort_order | INTEGER | |
| created_at | TEXT | |

Seed the five pillars from `01-product-overview.md`.

### `milestones`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| pillar_id | INTEGER FK → pillars | required |
| title | TEXT | |
| description | TEXT | nullable |
| status | TEXT | `active` / `done` / `archived` |
| target_date | TEXT | nullable |
| sort_order | INTEGER | |
| created_at | TEXT | |
| completed_at | TEXT | nullable |

Progress is **derived**, not stored (see views below).

### `tasks`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| pillar_id | INTEGER FK → pillars | **required** — the pillar this task counts toward |
| milestone_id | INTEGER FK → milestones | nullable (quick tasks need no milestone) |
| title | TEXT | |
| description | TEXT | nullable |
| status | TEXT | `todo` / `doing` / `done` / `archived` |
| is_urgent | INTEGER (bool) | for Eisenhower quadrant |
| is_important | INTEGER (bool) | for Eisenhower quadrant |
| estimated_duration_min | INTEGER | nullable; drives the countdown timer |
| timer_mode | TEXT | `pomodoro` / `manual`; default per user setting |
| due_date | TEXT | nullable |
| note_ref | TEXT | nullable; link to an Obsidian note (see `06`) |
| sort_order | INTEGER | board ordering |
| created_at | TEXT | |
| completed_at | TEXT | nullable |

**Invariant (enforced in the write tools, not by SQL):** if `milestone_id` is set, `tasks.pillar_id` must equal that milestone's `pillar_id`. Storing `pillar_id` directly on the task keeps pillar analytics a single clean join (`sessions → tasks → pillar`).

Eisenhower quadrant is derived from the two booleans. Kanban column maps to `status` (`todo` → To Do, `doing` → Doing, `done` → Done); use `sort_order` for within-column ordering.

### `subtasks`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| task_id | INTEGER FK → tasks | required |
| title | TEXT | |
| done | INTEGER (bool) | |
| sort_order | INTEGER | |
| created_at | TEXT | |
| completed_at | TEXT | nullable |

### `sessions`  (the time log)
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| task_id | INTEGER FK → tasks | required (pillar derived via task) |
| source | TEXT | `block` / `pomodoro` / `manual` |
| started_at | TEXT | nullable for pure manual entry |
| ended_at | TEXT | nullable |
| duration_min | INTEGER | the logged minutes (authoritative) |
| block_id | INTEGER FK → time_blocks | nullable; set when source = `block` |
| note | TEXT | nullable |
| created_at | TEXT | |

### `time_blocks`  (scheduled work, may sync to a calendar)
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| task_id | INTEGER FK → tasks | required |
| start_at | TEXT | |
| end_at | TEXT | |
| status | TEXT | `planned` / `done` / `skipped` |
| auto_logged | INTEGER (bool) | true once it auto-created a session |
| calendar_provider | TEXT | `google` / `outlook` / null |
| calendar_event_id | TEXT | external id, nullable |
| created_at | TEXT | |

Lifecycle in `04-time-tracking.md`. In short: when wall-clock passes `end_at`, the block flips to `done` and **auto-creates a session** for its duration — reversibly. Marking it `skipped` (from the morning brief) voids that session.

### `external_events`  (read-only mirror of existing calendar commitments)
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| provider | TEXT | `google` / `outlook` |
| external_id | TEXT | |
| title | TEXT | |
| start_at | TEXT | |
| end_at | TEXT | |
| last_synced | TEXT | |

These are meetings/commitments the dashboard reads so the day view is realistic. The dashboard never owns or edits them. Distinct from `time_blocks`, which the dashboard owns.

### `calendar_accounts`
| column | type | notes |
|--------|------|-------|
| id | INTEGER PK | |
| provider | TEXT | `google` / `outlook` |
| account_email | TEXT | |
| sync_token | TEXT | provider sync/delta token, nullable |
| last_sync | TEXT | |
| created_at | TEXT | |

OAuth tokens should be stored in the OS keychain / a secrets store, **not** in this table. Keep only a reference here.

## Derived views (recommended)

- `v_milestone_progress` — per milestone: `total_tasks`, `done_tasks`, `progress = done_tasks / NULLIF(total_tasks,0)`.
- `v_task_progress` — per task: `total_subtasks`, `done_subtasks`, fraction done.
- `v_pillar_time` — `pillar_id`, time bucket, `SUM(duration_min)`. Bucketing (day/week/month/year) can be done in the query layer rather than a fixed view.

## Notes for the implementer

- Use foreign keys with `ON DELETE` chosen deliberately (e.g. deleting a task should cascade its subtasks and sessions, or block deletion — decide and document).
- A task may have **multiple** time blocks and **multiple** sessions across days; never assume one-to-one.
- The read-only SQL escape hatch (`03`) runs against these tables/views, so keep names stable and documented.
