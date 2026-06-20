# Second Brain — Build Specification

This is the spec for a **local, single-user "second brain" dashboard** organized around five life pillars. It is the source of truth for what to build. Read `01-product-overview.md` first, then the data model, then the rest.

## The one idea that holds everything together

The dashboard is **not** the product — it is one of two clients. There are three layers:

1. **Data layer** — a local SQLite database, the single source of truth for all structured state (pillars, milestones, tasks, subtasks, time sessions, calendar blocks).
2. **Agentic layer** — an **MCP server** exposing a curated set of tools over that data. This is the *contract*. Nothing reads or writes the database directly except through it.
3. **Clients** — two of them, both consuming the agentic layer:
   - **Claude Code** — the planner/operator. It reads shaped summaries and issues commands ("plan my day", "log 40 min to task 12", "block this Tuesday 9–10").
   - **The dashboard** — a local web UI the user glances at each morning to grasp the day, drag tasks into time blocks, and see progress.

Obsidian notes are a **separate** retrieval surface (via LightRAG) that Claude Code can also read — see `06-notes-integration.md`. Notes are *not* funneled into SQLite, and SQLite is *not* funneled through LightRAG.

## Why this shape

- The whole point of the agentic layer is that Claude Code sees **shaped, purpose-built data, not raw dumps**. Common operations return exactly what's needed; an ad-hoc read-only SQL escape hatch covers the long tail. See `03-agentic-layer-mcp.md`.
- SQLite (not markdown) is the source of truth because every analytic the user wants — time per pillar, milestone %, heatmaps — is an aggregation query. Markdown-as-truth would mean constant reparsing. Markdown *export* is optional and one-directional.

## File map

| File | What it specifies |
|------|-------------------|
| `01-product-overview.md` | Vision, the five pillars, hierarchy, the morning brief, guiding principles |
| `02-data-model.md` | SQLite schema, relationships, rollup rules, the session-vs-status split |
| `03-agentic-layer-mcp.md` | The MCP tool surface (the contract), write-safety, the SQL escape hatch |
| `04-time-tracking.md` | Sessions and the three logging paths (block, pomodoro, manual) |
| `05-calendar-sync.md` | Push-plus-read sync with Google + Outlook; what is explicitly out of scope |
| `06-notes-integration.md` | LightRAG over Obsidian as a separate retrieval surface; cross-linking |
| `07-dashboard-views.md` | Every view and the exact tool/query that feeds it |
| `08-roadmap.md` | Phased build order (P0–P3) so the tool is useful early |

## Recommended stack (adjustable)

Local-first. Suggested, not mandatory:

- **Backend / MCP server / LightRAG:** Python (FastMCP for the MCP server; LightRAG is Python-native).
- **Database:** SQLite (single file, e.g. `~/.secondbrain/db.sqlite`).
- **Dashboard:** React (Vite). Talks to the same backend over a thin local HTTP API that wraps the same logic as the MCP tools.
- **Calendar:** Google Calendar API + Microsoft Graph, official SDKs.

Claude Code may substitute equivalents (e.g. a TypeScript MCP server) as long as the layering in this README is preserved.
