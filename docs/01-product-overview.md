# 01 — Product Overview

## What this is

A **local second brain** that shows, at a glance each morning, what to do to start the day — and over time, how the user's effort is distributed across five life pillars. It is single-user and runs on the user's own machine.

The user operates it two ways:
- **Through Claude Code** (primary). Claude Code is the planner and operator: "plan my day", "what's overdue in Cracked Engineer", "log 40 min to task 12", "block deep work Tuesday 9–10:30". This is the point of the product.
- **Through the dashboard** (a glanceable surface). The dashboard renders the same data: today's plan, kanban, Eisenhower matrix, a drag-to-schedule calendar, and pillar analytics.

## The five pillars

The user's life is organized into five fixed pillars. Store them as rows (extensible) but seed exactly these:

1. **Polymath Knowledge**
2. **Founder Mindset**
3. **Body Temple**
4. **Cracked Engineer**
5. **Soul Connection**

Each pillar gets a distinct display color (used by all visualizations). Defaults are a suggestion; let the user override.

## Hierarchy

```
Pillar  →  Milestone  →  Task  →  Subtask
```

- A **milestone** belongs to one pillar and represents a meaningful objective.
- A **task** belongs to a pillar; it *may* also belong to a milestone (quick tasks can attach to a pillar directly with no milestone).
- A **subtask** belongs to a task.

Progress rolls upward (see `02-data-model.md`):
- Subtask completion → contributes to its task's progress.
- Task completion (status = done) → contributes to its milestone's progress.
- Milestone progress for v1 is **count-based**: `done_tasks / total_tasks`. A time-weighted version is a later toggle, not v1.

## The morning brief — the centerpiece

The single most important read in the system is the **morning brief**: a compact summary the user (or Claude Code) pulls to start the day. It contains:

- Today's scheduled **time blocks** (and any external calendar commitments to plan around).
- **Overdue** and **due-today** tasks.
- Anything currently **in progress** (status = doing).
- Yesterday's blocks awaiting confirmation (did you actually do them? — see `04-time-tracking.md`).
- A quick per-pillar **time summary** (this week so far).

Everything else (boards, analytics) exists to support this glance.

## Guiding principles

1. **Structured state is exact; knowledge is fuzzy.** Tasks/milestones live in SQLite and are queried exactly. Notes live in Obsidian and are retrieved semantically via LightRAG. Never blur the two.
2. **The agentic layer is the only door.** Both clients and Claude Code go through the MCP tools. No client reaches into the database directly.
3. **Shaped over raw.** Reads return purpose-built summaries so Claude Code spends tokens on thinking, not on parsing dumps.
4. **Writes are constrained.** Claude Code never issues arbitrary mutating SQL; all writes go through validated tools. Read-only SQL is allowed as an escape hatch.
5. **Local-first.** The database is a local file. The only network egress is calendar sync.
6. **Time and status are independent.** How long you spent on a task and whether the task is done are separate facts. This is foundational — see `02` and `04`.

## Explicitly out of scope for v1

- Two-way calendar sync (push-plus-read only — see `05`).
- Balance/neglect reminders (the analytics show pillar time; no nudges yet).
- Time-weighted milestone progress (count-based only).
- Multi-user, mobile app, cloud hosting.
