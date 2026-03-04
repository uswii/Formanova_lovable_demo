import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Batch Management", to: "/admin" },
  { label: "Users",            to: "/admin/users" },
  { label: "Workflows",        to: "/admin/workflows" },
  { label: "Analytics",        to: "/admin/analytics" },
  { label: "Tenants",          to: "/admin/tenants" },
];

export function PipelineAdminNav() {
  return (
    <nav className="flex gap-1 border-b mb-6 pb-0">
      {TABS.map(({ label, to }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/admin"}
          className={({ isActive }) =>
            cn(
              "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
