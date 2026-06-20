# 05 — Calendar Sync (Push-Plus-Read)

The model is **push-plus-read**, deliberately *not* two-way. The dashboard is the only editor of the blocks it creates; the external calendar is a mirror for those blocks and a read-only source of existing commitments.

## Read

- On a schedule (and on demand), pull existing events from the connected Google and/or Outlook calendars into `external_events` (see `02`).
- These are the user's meetings/commitments. The day view shows them so the user plans real time blocks around them.
- The dashboard **never edits or deletes** external events. They are read-only context.

## Push

- When the user creates a time block (`create_time_block`), the backend creates a corresponding event in the connected calendar and stores its `calendar_event_id` + `calendar_provider` on the `time_blocks` row.
- `move_time_block` updates that external event; `delete_time_block` removes it.
- Authority flows one way: **dashboard → calendar**. The dashboard owns these events.
- Tag pushed events (e.g. a property/category or a title prefix) so they are identifiable as dashboard-owned and never re-imported as external commitments (avoid echo loops with the read step — exclude dashboard-owned events when populating `external_events`).

## Explicitly NOT in scope

- **No backflow.** If the user moves/resizes/deletes a dashboard-pushed block *inside* Google or Outlook (e.g. on their phone), the dashboard does **not** learn about it. That is two-way sync and is out of scope for v1.
- No conflict resolution, no change-detection webhooks for our own blocks, no delete-reconciliation from the external side.

(If two-way is ever added later, it requires: change detection via push notifications / delta sync tokens, conflict resolution between near-simultaneous edits, dedup to avoid re-importing our own pushes, and delete handling from either side. Roughly doubles the sync code. Not now.)

## Providers

- **Google:** Google Calendar API. OAuth 2.0; scope limited to calendar read + event write on the user's primary (or chosen) calendar.
- **Outlook:** Microsoft Graph calendar endpoints. OAuth 2.0 equivalently scoped.
- Store account references in `calendar_accounts`; keep OAuth tokens in the OS keychain / secrets store, not in the DB.
- Connecting a calendar is optional — the rest of the product works fully offline without it (blocks just don't sync, and there are no external events to show).

## Sync timing

- Read sync: on app open and on a light interval (e.g. every N minutes) — enough to keep the day view current.
- Push: synchronous with the block create/move/delete action, with a retry/queue if the network call fails so a transient failure doesn't lose the block locally (the local block is the source of truth and must persist regardless).
