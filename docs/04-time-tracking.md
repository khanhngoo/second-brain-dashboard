# 04 — Time Tracking

All time tracking produces **sessions** (see `02-data-model.md`). A session is minutes attributed to a task; the task's pillar makes it count toward pillar analytics. Logging time never changes a task's status unless explicitly requested.

There are exactly three ways a session is created.

## Path 1 — Calendar block

A task dragged into a time block (in the dashboard or via `create_time_block`) is scheduled work. The block may be pushed to Google/Outlook (see `05`).

**Auto-log rule (reversible):** when wall-clock time passes the block's `end_at`, the block flips `planned → done` and **auto-creates a session** for the block's duration (`auto_logged = true`).

This is a *default*, not a fact — passing 10:30 doesn't prove the work happened. So:

- The **morning brief** surfaces yesterday's auto-logged blocks for a one-glance review.
- `confirm_blocks(date)` accepts them as-is.
- `mark_block_skipped(id)` sets the block `skipped` and **voids the auto-created session** (so skipped work never inflates pillar time).

**Important:** finishing a block logs *time only*. It does **not** mark the task `done`. A task can span several blocks across days; task completion is always an explicit `set_task_status(id, "done")`. Milestone progress rides only on task-done, so this separation must hold.

## Path 2 — Pomodoro timer (committed time-box)

For tasks the user starts right now without scheduling. The user hits start; the timer **counts down** from the task's `estimated_duration_min` (falling back to a default, e.g. 25 min, if unset).

- On reaching zero, **auto-log the full duration** as a session (`source = pomodoro`).
- Pomodoro is a *committed box*: finishing the work early just means resting until the timer ends. (If you want variable-length tracking, use manual mode — that is the point of having two modes.)
- Status is untouched.

## Path 3 — Manual timer (open-ended)

Also a "start right now" path, but variable-length. The user hits start; the timer counts toward `estimated_duration_min` and **keeps running past it** (overtime is tracked, not cut off). Nothing is written until the user confirms, via two distinct affordances:

- **Stop** → logs the elapsed session (`source = manual`); the task stays open (status unchanged).
- **Done** → logs the elapsed session **and** sets the task `done`.

These are two outcomes of the same moment but two separate writes (session vs status), preserving the split. "I worked 40 minutes but I'm not finished" and "I'm finished" must produce different results.

## Why two timer modes resolve the early/overtime question

There's deliberately no special rule for "finished early." The mode is the answer:

- **Pomodoro** = fixed box → log the box.
- **Manual** = you control the stop → early *and* overtime fall out naturally.

`timer_mode` is stored per task (default from a user setting) so each task starts in the right mode, and can be overridden at start time.

## Manual / explicit entry

`log_session(task_id, duration_min, ...)` lets the user (or Claude Code) record time after the fact with no timer at all — e.g. "log 30 min to task 12." `source = manual`.

## Where timers live

Timers are primarily a **dashboard UI** concern (the countdown UI, start/stop buttons). The backend's job is to persist the resulting session. The MCP `start_timer`/`stop_timer` tools exist so Claude Code can drive a timer too, but the simplest correct implementation is: dashboard runs the timer in-UI, then calls `log_session` (or `set_task_status` for Done) on stop. Keep the persisted result identical regardless of which client ran the clock.
