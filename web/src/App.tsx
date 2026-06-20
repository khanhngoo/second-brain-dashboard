import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { PillarSwitcher } from "./components/PillarSwitcher";
import { TodayView } from "./views/TodayView";
import { KanbanView } from "./views/KanbanView";
import { AnalyticsView } from "./views/AnalyticsView";
import { MilestonesView } from "./views/MilestonesView";
import { EisenhowerView } from "./views/EisenhowerView";
import { CalendarView } from "./views/CalendarView";

const NAV = [
  { to: "/today", label: "Today" },
  { to: "/kanban", label: "Kanban" },
  { to: "/eisenhower", label: "Eisenhower" },
  { to: "/calendar", label: "Calendar" },
  { to: "/analytics", label: "Analytics" },
  { to: "/milestones", label: "Milestones" },
];

export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <h1 className="brand">🧠 Second Brain</h1>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <PillarSwitcher />
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayView />} />
          <Route path="/kanban" element={<KanbanView />} />
          <Route path="/eisenhower" element={<EisenhowerView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/analytics" element={<AnalyticsView />} />
          <Route path="/milestones" element={<MilestonesView />} />
        </Routes>
      </main>
    </div>
  );
}
