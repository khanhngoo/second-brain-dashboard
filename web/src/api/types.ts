// Hand-written mirror of the backend contract (docs/02 rows + composite reads).
// FastAPI routes have no response_model, so OpenAPI codegen would yield `any`;
// these types ARE the contract on the client side. A pytest asserts the route
// key-sets match these (contract-drift guard).

export type TaskStatus = "todo" | "doing" | "done" | "archived";
export type MilestoneStatus = "active" | "done" | "archived";
export type SessionSource = "block" | "manual";
export type BlockStatus = "planned" | "done" | "skipped";

export interface Pillar {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  created_at: string;
}

export interface PillarRollup extends Pillar {
  open_tasks: number;
  minutes_this_week: number;
}

export interface Milestone {
  id: number;
  title: string;
  description: string | null;
  status: MilestoneStatus;
  target_date: string | null;
  sort_order: number;
  created_at: string;
  completed_at: string | null;
  total_tasks: number | null;
  done_tasks: number | null;
  progress: number | null;
  total_minutes: number;
}

export interface Task {
  id: number;
  pillar_id: number;
  milestone_id: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  is_impact: number;
  is_effort: number;
  due_date: string | null;
  note_ref: string | null;
  sort_order: number;
  created_at: string;
  completed_at: string | null;
  milestone_title?: string | null;
  actual_duration_min?: number;
}

export interface ArchivedTask {
  id: number;
  pillar_id: number;
  pillar_slug: string;
  pillar_name: string;
  pillar_color: string | null;
  milestone_id: number | null;
  milestone_title: string | null;
  title: string;
  description: string | null;
  status: "done";
  is_impact: number;
  is_effort: number;
  actual_duration_min: number;
  due_date: string | null;
  note_ref: string | null;
  sort_order: number;
  created_at: string;
  completed_at: string;
}

export interface Subtask {
  id: number;
  task_id: number;
  title: string;
  done: number;
  sort_order: number;
  created_at: string;
  completed_at: string | null;
}

export interface TaskDetail extends Task {
  subtasks: Subtask[];
  sessions_total_min: number;
  blocks: TimeBlock[];
}

export interface Session {
  id: number;
  task_id: number;
  source: SessionSource;
  started_at: string | null;
  ended_at: string | null;
  duration_min: number;
  block_id: number | null;
  voided: number;
  note: string | null;
  created_at: string;
}

export interface TimeBlock {
  id: number;
  task_id: number;
  start_at: string;
  end_at: string;
  status: BlockStatus;
  auto_logged: number;
  confirmed: number;
  calendar_provider: string | null;
  calendar_event_id: string | null;
  created_at: string;
}

export interface ExternalEvent {
  id: number;
  provider: string;
  external_id: string;
  title: string | null;
  start_at: string;
  end_at: string;
  last_synced: string | null;
}

export interface ImpactEffort {
  high_impact_low_effort: Task[];
  high_impact_high_effort: Task[];
  low_impact_low_effort: Task[];
  low_impact_high_effort: Task[];
}

export type Quadrant = keyof ImpactEffort;

export interface PillarTimeRow {
  pillar_id: number;
  slug: string;
  name: string;
  bucket: string | null;
  minutes: number;
}

export type Bucket = "day" | "week" | "month" | "year";

export interface PillarWithMilestones extends Pillar {
  minutes_this_week: number;
}

// P3 — calendar status
export interface CalendarStatus {
  enabled: boolean;
  accounts: { provider: string; account_email: string; last_sync: string | null }[];
}
