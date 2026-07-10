import { BookOpen } from "lucide-react";

export function JournalsView() {
  return (
    <div className="view-stack">
      <div className="view-heading">
        <p className="eyebrow">Reflection</p>
        <h2 className="view-title">Journals</h2>
      </div>
      <div className="placeholder-panel">
        <BookOpen size={28} className="muted-icon" />
        <p className="empty">Journals are coming soon.</p>
      </div>
    </div>
  );
}
