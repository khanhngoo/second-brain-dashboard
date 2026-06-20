# 06 — Notes Integration (Obsidian via LightRAG)

The user's knowledge lives in **Obsidian** (markdown notes). This is a *separate* retrieval surface from the structured task database — and the separation is intentional.

## The boundary (do not blur this)

- **Obsidian notes** are unstructured text → retrieved **semantically/graph-wise via LightRAG** (which builds its own entity/relation knowledge graph plus vector retrieval over the corpus). Good for "what did I conclude about X", "connect my notes on Y".
- **SQLite tasks/milestones** are structured, exact, transactional → queried directly (see `02`/`03`). Good for "task 47, due Tuesday, status doing" and aggregations.

**Do not route SQLite through LightRAG.** Pushing exact records through an LLM-extraction → embedding → fuzzy-retrieval pipeline is lossy, can't aggregate (`SUM`/`GROUP BY` is not a retrieval), and returns *similar* rather than *exact* records. It would destroy the precision that makes the task data useful.

**Do not import Obsidian notes into SQLite** either. Notes stay in Obsidian; LightRAG indexes them in place.

## The architecture: two surfaces, one synthesizer

```
Obsidian notes ──► LightRAG ──► notes_search() ─┐
                                                 ├──►  Claude Code  ──► synthesis
SQLite (tasks) ──────────────► task tools ──────┘
```

Claude Code holds **both** tools and combines them. When the user says "plan my day," Claude pulls exact tasks/blocks from the task tools and pulls relevant context from notes via `notes_search`, then synthesizes. The merge happens in Claude's reasoning, **not** in a combined data pipeline.

## `notes_search`

Exposed as an MCP tool (see `03`):

- `notes_search(query, k?)` → runs LightRAG retrieval over the Obsidian vault; returns top note snippets with their file paths / vault links. Returns knowledge, never task records.

## Cross-linking (a foreign key, not a merged graph)

A task may carry a `note_ref` (see `02`) pointing to a specific Obsidian note (path or wiki-link). This lets Claude jump from "this milestone/task" to "the notes about it" — a deliberate reference, not an automatic fusion of the two stores.

## Implementation notes

- LightRAG is Python-native; run it in (or alongside) the backend process.
- Keep the LightRAG index pointed at the Obsidian vault directory; re-index on a schedule or on file change so retrieval stays current. The index is derived and disposable — Obsidian remains the source of truth for notes, just as SQLite is for tasks.
- This integration is **not required for v1's core loop** (see `08-roadmap.md`); it can land after the task/dashboard loop works, since the morning brief functions without it.
