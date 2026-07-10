import { NavLink } from "react-router-dom";
import {
  Archive,
  BarChart3,
  BookOpen,
  CalendarDays,
  Feather,
  GitFork,
  Milestone,
} from "lucide-react";

// Single-level navigation: every destination lives in the side rail, grouped
// into the day-to-day task views ("Workspace") and long-form spaces.
export const WORKSPACE_LINKS = [
  { to: "/impact-effort", label: "Impact / Effort", icon: GitFork },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/archive", label: "Archive", icon: Archive },
  { to: "/milestones", label: "Milestones", icon: Milestone },
];

export const SPACE_LINKS = [
  { to: "/journals", label: "Journals", icon: BookOpen },
  { to: "/memoir", label: "Memoir", icon: Feather },
];

export const WORKSPACE_ROUTE_LIST = WORKSPACE_LINKS.map((l) => l.to);

function NavGroup({ label, links }: { label: string; links: typeof WORKSPACE_LINKS }) {
  return (
    <div className="side-group">
      <p className="nav-section-label">{label}</p>
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <NavLink
            key={l.to}
            to={l.to}
            className={({ isActive }) => (isActive ? "side-link active" : "side-link")}
          >
            <Icon size={18} />
            <span>{l.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

export function SideNav() {
  return (
    <nav className="side-nav" aria-label="Primary">
      <NavGroup label="Workspace" links={WORKSPACE_LINKS} />
      <NavGroup label="Spaces" links={SPACE_LINKS} />
    </nav>
  );
}
