import { NavLink, useLocation } from "react-router-dom";
import { BookOpen, Feather, LayoutGrid } from "lucide-react";

// The day-to-day task views live behind "Workspace" (a tab strip, see App.tsx);
// the two long-form spaces are their own side-rail destinations.
export const WORKSPACE_ROUTE_LIST = [
  "/impact-effort",
  "/calendar",
  "/analytics",
  "/archive",
  "/milestones",
];

export function SideNav() {
  const { pathname } = useLocation();
  const workspaceActive = WORKSPACE_ROUTE_LIST.includes(pathname);

  return (
    <nav className="side-nav" aria-label="Primary">
      <NavLink
        to="/impact-effort"
        className={workspaceActive ? "side-link active" : "side-link"}
      >
        <LayoutGrid size={18} />
        <span>Workspace</span>
      </NavLink>
      <NavLink
        to="/journals"
        className={({ isActive }) => (isActive ? "side-link active" : "side-link")}
      >
        <BookOpen size={18} />
        <span>Journals</span>
      </NavLink>
      <NavLink
        to="/memoir"
        className={({ isActive }) => (isActive ? "side-link active" : "side-link")}
      >
        <Feather size={18} />
        <span>Memoir</span>
      </NavLink>
    </nav>
  );
}
