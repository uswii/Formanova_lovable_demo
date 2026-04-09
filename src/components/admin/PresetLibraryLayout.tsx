import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const SUB_TABS = [
  { label: 'Models', to: '/admin/preset-library/models' },
  { label: 'Inspirations', to: '/admin/preset-library/inspirations' },
];

export function PresetLibraryLayout() {
  return (
    <div>
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6">
        <nav className="flex gap-1 border-b mb-0">
          {SUB_TABS.map(({ label, to }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
