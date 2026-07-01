import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Archive, Plus } from "lucide-react";
import { useImpactEffort, useArchiveDone } from "./hooks/queries";
import { PillarSwitcher } from "./components/PillarSwitcher";
import { SideNav, WORKSPACE_ROUTE_LIST } from "./components/SideNav";
import { WorkspaceTabs } from "./components/WorkspaceTabs";
import { TaskDrawer } from "./components/TaskDrawer";
import { BlockDrawer } from "./components/BlockDrawer";
import { AnalyticsView } from "./views/AnalyticsView";
import { MilestonesView } from "./views/MilestonesView";
import { ImpactEffortView } from "./views/ImpactEffortView";
import { CalendarView } from "./views/CalendarView";
import { ArchiveView } from "./views/ArchiveView";
import { JournalsView } from "./views/JournalsView";
import { MemoirView } from "./views/MemoirView";
import { useTaskDrawer } from "./state/taskDrawer";

export function App() {
  const { openTaskDrawer } = useTaskDrawer();
  const { pathname } = useLocation();
  const inWorkspace = WORKSPACE_ROUTE_LIST.includes(pathname);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true">✳</span>
          Second Brain
        </h1>
        <SideNav />
      </aside>

      <div className="workspace">
        <header className="topbar">
          {inWorkspace ? <WorkspaceTabs /> : <span className="topbar-spacer" />}
          <div className="top-actions">
            {inWorkspace && <ArchiveDoneButton />}
            <button className="btn primary top-action" onClick={() => openTaskDrawer()} type="button">
              <Plus size={16} />
              Add Task
            </button>
          </div>
        </header>
        {inWorkspace && (
          <div className="filter-bar">
            <PillarSwitcher />
          </div>
        )}

        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/impact-effort" replace />} />
            <Route path="/impact-effort" element={<ImpactEffortView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/analytics" element={<AnalyticsView />} />
            <Route path="/archive" element={<ArchiveView />} />
            <Route path="/milestones" element={<MilestonesView />} />
            <Route path="/journals" element={<JournalsView />} />
            <Route path="/memoir" element={<MemoirView />} />
            <Route path="*" element={<Navigate to="/impact-effort" replace />} />
          </Routes>
        </main>
      </div>

      <TaskDrawer />
      <BlockDrawer />
    </div>
  );
}

// Sweeps every done task across the four matrix quadrants into the archive.
function ArchiveDoneButton() {
  const { data } = useImpactEffort();
  const archive = useArchiveDone();
  const doneIds = data
    ? Object.values(data)
        .flat()
        .filter((t) => t.status === "done")
        .map((t) => t.id)
    : [];

  return (
    <button
      className="btn secondary top-action"
      type="button"
      onClick={() => archive.mutate(doneIds)}
      disabled={doneIds.length === 0 || archive.isPending}
      title="Archive all completed tasks"
    >
      <Archive size={16} />
      {archive.isPending ? "Archiving…" : `Archive done${doneIds.length ? ` (${doneIds.length})` : ""}`}
    </button>
  );
}
