import { NavLink } from 'react-router-dom';
import { Home, ScanSearch, Map, Navigation } from 'lucide-react';

const items = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/detect', label: 'Detect', icon: ScanSearch },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/route', label: 'Route', icon: Navigation },
];

// phone-style tab bar, only on small screens
export default function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-white/[.07] bg-asphalt-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Sections"
    >
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-amber' : 'text-zinc-500'
                }`
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
