import { NavLink } from "react-router-dom";
import { Archive, BarChart3, CalendarDays, GitFork, Milestone } from "lucide-react";

const TABS = [
  { to: "/impact-effort", label: "Impact / Effort", icon: GitFork },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/archive", label: "Archive", icon: Archive },
  { to: "/milestones", label: "Milestones", icon: Milestone },
];

// Router-driven tab strip — each tab is a NavLink so views stay deep-linkable
// and the browser back button works. Styled as a segmented tab bar.
export function WorkspaceTabs() {
  return (
    <div className="workspace-tabs" role="tablist" aria-label="Workspace views">
      {TABS.map((t) => {
        const Icon = t.icon;
        return (
          <NavLink
            key={t.to}
            to={t.to}
            role="tab"
            className={({ isActive }) => (isActive ? "workspace-tab active" : "workspace-tab")}
          >
            <Icon size={16} />
            {t.label}
          </NavLink>
        );
      })}
    </div>
  );
}
