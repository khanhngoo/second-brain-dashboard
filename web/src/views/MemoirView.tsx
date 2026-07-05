import { Feather } from "lucide-react";

export function MemoirView() {
  return (
    <div className="view-stack">
      <div className="view-heading">
        <p className="eyebrow">Long arc</p>
        <h2 className="view-title">Memoir</h2>
      </div>
      <div className="placeholder-panel">
        <Feather size={28} className="muted-icon" />
        <p className="empty">Memoir is coming soon.</p>
      </div>
    </div>
  );
}
