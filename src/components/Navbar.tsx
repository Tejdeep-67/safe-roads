import { NavLink, Link } from 'react-router-dom';
import { Github } from 'lucide-react';
import Logo from './Logo';
import { REPO_URL } from '../config';

const links = [
  { to: '/detect', label: 'Detect' },
  { to: '/map', label: 'Hazard map' },
  { to: '/route', label: 'Route alerts' },
  { to: '/about', label: 'How it works' },
];

export default function Navbar() {
  return (
    <header className="sticky top-0 z-[1000] border-b border-white/[.06] bg-asphalt-950/75 backdrop-blur-xl">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6" aria-label="Main">
        <Link to="/" className="flex items-center gap-2.5" aria-label="Safe Roads home">
          <Logo />
          <span className="font-display text-[17px] font-semibold tracking-tight text-white">
            Safe<span className="text-amber">Roads</span>
          </span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `relative rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-100'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {l.label}
                  <span
                    className={`absolute inset-x-3 -bottom-[9px] h-0.5 rounded-full bg-amber transition-transform duration-300 ${
                      isActive ? 'scale-x-100' : 'scale-x-0'
                    }`}
                  />
                </>
              )}
            </NavLink>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="btn-ghost !px-3 !py-2" aria-label="Source code on GitHub">
            <Github className="h-4 w-4" />
            <span className="hidden sm:inline">Code</span>
          </a>
          <Link to="/detect" className="btn-primary hidden !py-2 sm:inline-flex">
            Try it
          </Link>
        </div>
      </nav>
    </header>
  );
}
