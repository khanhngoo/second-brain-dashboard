export function ProgressBar({
  fraction,
  label,
}: {
  fraction: number | null;
  label?: string;
}) {
  const pct = fraction == null ? 0 : Math.round(fraction * 100);
  return (
    <div className="progress">
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="progress-label">{label ?? `${pct}%`}</span>
    </div>
  );
}
