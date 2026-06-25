import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { Archive, BarChart3, CalendarDays, GitFork, Milestone, Plus } from "lucide-react";
import { PillarSwitcher } from "./components/PillarSwitcher";
import { TaskDrawer } from "./components/TaskDrawer";
import { BlockDrawer } from "./components/BlockDrawer";
import { AnalyticsView } from "./views/AnalyticsView";
import { MilestonesView } from "./views/MilestonesView";
import { EisenhowerView } from "./views/EisenhowerView";
import { CalendarView } from "./views/CalendarView";
import { ArchiveView } from "./views/ArchiveView";
import { useTaskDrawer } from "./state/taskDrawer";

const NAV = [
  { to: "/eisenhower", label: "Eisenhower", icon: GitFork },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/archive", label: "Archive", icon: Archive },
  { to: "/milestones", label: "Milestones", icon: Milestone },
];

export function App() {
  const { openTaskDrawer } = useTaskDrawer();

  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">
          <span className="brand-mark" aria-hidden="true">✳</span>
          Second Brain
        </h1>
        <nav className="nav">
          {NAV.map((n) => {
            const Icon = n.icon;
            return (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              <Icon size={16} />
              {n.label}
            </NavLink>
            );
          })}
        </nav>
        <button className="btn primary top-action" onClick={() => openTaskDrawer()} type="button">
          <Plus size={16} />
          Add Task
        </button>
        <PillarSwitcher />
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/eisenhower" replace />} />
          <Route path="/eisenhower" element={<EisenhowerView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/analytics" element={<AnalyticsView />} />
          <Route path="/archive" element={<ArchiveView />} />
          <Route path="/milestones" element={<MilestonesView />} />
          <Route path="*" element={<Navigate to="/eisenhower" replace />} />
        </Routes>
      </main>
      <TaskDrawer />
      <BlockDrawer />
    </div>
  );
}
