-- Second Brain schema (see docs/02 — Data Model).
-- All times are UTC ISO-8601 TEXT. Booleans are INTEGER 0/1.
--
-- Tables 1:1 with docs/02, plus two P0 additions (marked [P0+]):
--   * sessions.voided         -- soft-void for skipped auto-logs (reversibility)
--   * time_blocks.confirmed   -- morning-brief confirm state

PRAGMA user_version = 3;

-- ---------------------------------------------------------------------------
-- pillars  (the five fixed life pillars; rows are extensible, seed exactly 5)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pillars (
    id          INTEGER PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    color       TEXT,            -- hex, for visualizations
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- milestones  (belong to one pillar; progress is DERIVED, never stored)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS milestones (
    id           INTEGER PRIMARY KEY,
    pillar_id    INTEGER NOT NULL REFERENCES pillars(id) ON DELETE RESTRICT,
    title        TEXT NOT NULL,
    description  TEXT,
    status       TEXT NOT NULL DEFAULT 'active',   -- active / done / archived
    target_date  TEXT,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    completed_at TEXT
);

-- ---------------------------------------------------------------------------
-- tasks  (belong to a pillar; may belong to a milestone)
-- Invariant (enforced in core, not SQL): if milestone_id is set, pillar_id
-- must equal that milestone's pillar_id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id                     INTEGER PRIMARY KEY,
    pillar_id              INTEGER NOT NULL REFERENCES pillars(id) ON DELETE RESTRICT,
    milestone_id           INTEGER REFERENCES milestones(id) ON DELETE SET NULL,
    title                  TEXT NOT NULL,
    description            TEXT,
    status                 TEXT NOT NULL DEFAULT 'todo',   -- todo / doing / done / archived
    is_impact              INTEGER NOT NULL DEFAULT 0,
    is_effort              INTEGER NOT NULL DEFAULT 0,
    due_date               TEXT,
    note_ref               TEXT,           -- link to an Obsidian note (docs/06)
    sort_order             INTEGER NOT NULL DEFAULT 0,
    created_at             TEXT NOT NULL,
    completed_at           TEXT
);

-- ---------------------------------------------------------------------------
-- subtasks  (belong to a task; cascade on task delete)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS subtasks (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    done         INTEGER NOT NULL DEFAULT 0,
    sort_order   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    completed_at TEXT
);

-- ---------------------------------------------------------------------------
-- sessions  (the time log; duration_min is authoritative)
-- RESTRICT on task delete: the time ledger is immutable (archive, don't delete).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id           INTEGER PRIMARY KEY,
    task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    source       TEXT NOT NULL DEFAULT 'manual',   -- block / pomodoro / manual / adhd
    started_at   TEXT,
    ended_at     TEXT,
    duration_min INTEGER NOT NULL,
    block_id     INTEGER REFERENCES time_blocks(id) ON DELETE SET NULL,
    voided       INTEGER NOT NULL DEFAULT 0,        -- [P0+] excluded from time analytics
    note         TEXT,
    created_at   TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- time_blocks  (scheduled work the dashboard owns; may sync to a calendar)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS time_blocks (
    id                INTEGER PRIMARY KEY,
    task_id           INTEGER NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
    start_at          TEXT NOT NULL,
    end_at            TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'planned',   -- planned / done / skipped
    auto_logged       INTEGER NOT NULL DEFAULT 0,        -- true once it auto-created a session
    confirmed         INTEGER NOT NULL DEFAULT 0,        -- [P0+] morning-brief confirm state
    calendar_provider TEXT,                              -- google / outlook / null
    calendar_event_id TEXT,
    created_at        TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- external_events  (read-only mirror of existing calendar commitments)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS external_events (
    id          INTEGER PRIMARY KEY,
    provider    TEXT NOT NULL,        -- google / outlook
    external_id TEXT NOT NULL,
    title       TEXT,
    start_at    TEXT NOT NULL,
    end_at      TEXT NOT NULL,
    last_synced TEXT
);

-- ---------------------------------------------------------------------------
-- calendar_accounts  (OAuth tokens live in the OS keychain, NOT here)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_accounts (
    id            INTEGER PRIMARY KEY,
    provider      TEXT NOT NULL,
    account_email TEXT NOT NULL,
    sync_token    TEXT,
    last_sync     TEXT,
    created_at    TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- calendar_outbox  [P3]  (retry queue for calendar pushes)
-- The local time_block is the source of truth and persists regardless; a failed
-- push is enqueued here and drained on the next sync tick (eventually consistent).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calendar_outbox (
    id         INTEGER PRIMARY KEY,
    op         TEXT NOT NULL,        -- create / update / delete
    block_id   INTEGER,             -- the local time_block (may be gone for delete)
    payload    TEXT,                -- JSON: title/start_at/end_at/calendar_event_id
    attempts   INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_tasks_pillar      ON tasks(pillar_id);
CREATE INDEX IF NOT EXISTS idx_tasks_milestone   ON tasks(milestone_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status      ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due         ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_sessions_task     ON sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_sessions_started  ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_blocks_task       ON time_blocks(task_id);
CREATE INDEX IF NOT EXISTS idx_blocks_start      ON time_blocks(start_at);
CREATE INDEX IF NOT EXISTS idx_blocks_status     ON time_blocks(status);
CREATE INDEX IF NOT EXISTS idx_subtasks_task     ON subtasks(task_id);
CREATE INDEX IF NOT EXISTS idx_milestones_pillar ON milestones(pillar_id);

-- ---------------------------------------------------------------------------
-- Derived views (docs/02)
-- ---------------------------------------------------------------------------

-- Per task: subtask completion fraction.
CREATE VIEW IF NOT EXISTS v_task_progress AS
SELECT
    t.id AS task_id,
    COUNT(s.id) AS total_subtasks,
    COALESCE(SUM(s.done), 0) AS done_subtasks,
    CASE WHEN COUNT(s.id) = 0 THEN NULL
         ELSE COALESCE(SUM(s.done), 0) * 1.0 / COUNT(s.id)
    END AS fraction
FROM tasks t
LEFT JOIN subtasks s ON s.task_id = t.id
GROUP BY t.id;

-- Per milestone: count-based progress. Archived tasks are excluded from the
-- denominator so abandoning a task never drags a milestone toward 0%.
CREATE VIEW IF NOT EXISTS v_milestone_progress AS
SELECT
    m.id AS milestone_id,
    COUNT(t.id) AS total_tasks,
    COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) AS done_tasks,
    COALESCE(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END), 0) * 1.0
        / NULLIF(COUNT(t.id), 0) AS progress
FROM milestones m
LEFT JOIN tasks t
       ON t.milestone_id = m.id
      AND t.status != 'archived'
GROUP BY m.id;

-- Per pillar per day: logged minutes. Voided sessions excluded. The query
-- layer buckets day -> week/month/year.
CREATE VIEW IF NOT EXISTS v_pillar_time AS
SELECT
    t.pillar_id AS pillar_id,
    date(COALESCE(s.started_at, s.created_at)) AS day,
    SUM(s.duration_min) AS minutes
FROM sessions s
JOIN tasks t ON t.id = s.task_id
WHERE s.voided = 0
GROUP BY t.pillar_id, day;
