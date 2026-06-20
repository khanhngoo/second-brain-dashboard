import {
  useConfirmBlocks,
  useSkipBlock,
  useTodayBrief,
} from "../hooks/queries";
import { TaskCard } from "../components/TaskCard";
import type { TimeBlock } from "../api/types";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function TodayView() {
  const { data: brief, isLoading, isError } = useTodayBrief();
  const confirm = useConfirmBlocks();
  const skip = useSkipBlock();

  if (isLoading) return <p className="muted">Loading today…</p>;
  if (isError || !brief) return <p className="muted">Could not load the brief.</p>;

  return (
    <div>
      <h2 className="view-title">Today — {brief.date}</h2>

      <section className="section">
        <h3>This week, per pillar</h3>
        <div className="minutes-strip">
          {brief.week_pillar_minutes.map((p) => (
            <div className="minutes-chip" key={p.pillar_id}>
              <div className="n">{p.minutes}m</div>
              <div className="muted">{p.name}</div>
            </div>
          ))}
        </div>
      </section>

      {brief.unconfirmed_blocks.length > 0 && (
        <section className="section panel">
          <h3>Yesterday — confirm or skip</h3>
          {brief.unconfirmed_blocks.map((b: TimeBlock) => (
            <div className="block-row" key={b.id}>
              <span>
                Block #{b.id} · {fmtTime(b.start_at)}–{fmtTime(b.end_at)}
              </span>
              <span className="btn-row">
                <button
                  className="btn"
                  onClick={() => confirm.mutate(b.end_at.slice(0, 10))}
                >
                  Confirm
                </button>
                <button className="btn ghost" onClick={() => skip.mutate(b.id)}>
                  Skip
                </button>
              </span>
            </div>
          ))}
        </section>
      )}

      <div className="brief-grid">
        <div>
          <section className="section">
            <h3>Today's blocks</h3>
            {brief.blocks.length === 0 ? (
              <p className="empty">Nothing scheduled.</p>
            ) : (
              brief.blocks.map((b) => (
                <div className="block-row" key={b.id}>
                  <span>Block #{b.id}</span>
                  <span className="muted">
                    {fmtTime(b.start_at)}–{fmtTime(b.end_at)} · {b.status}
                  </span>
                </div>
              ))
            )}
          </section>

          <section className="section">
            <h3>External commitments</h3>
            {brief.external_events.length === 0 ? (
              <p className="empty">No external events.</p>
            ) : (
              brief.external_events.map((e) => (
                <div className="block-row" key={e.id}>
                  <span>{e.title ?? "(untitled)"}</span>
                  <span className="muted">
                    {fmtTime(e.start_at)}–{fmtTime(e.end_at)}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>

        <div>
          <section className="section">
            <h3>In progress</h3>
            {brief.in_progress.length === 0 ? (
              <p className="empty">Nothing in progress.</p>
            ) : (
              brief.in_progress.map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </section>

          <section className="section">
            <h3>Due today</h3>
            {brief.due_today.length === 0 ? (
              <p className="empty">Nothing due.</p>
            ) : (
              brief.due_today.map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </section>

          <section className="section">
            <h3>Overdue</h3>
            {brief.overdue.length === 0 ? (
              <p className="empty">Nothing overdue. 🎉</p>
            ) : (
              brief.overdue.map((t) => <TaskCard key={t.id} task={t} />)
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
