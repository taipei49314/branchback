import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

const links = [
  { to: '/', label: 'Home', end: true },
  { to: '/decisions', label: 'Decisions' },
  { to: '/decisions/new', label: 'New' },
  { to: '/search', label: 'Search' },
  { to: '/timeline', label: 'Timeline' },
  { to: '/calibration', label: 'Calibration' },
  { to: '/assumptions', label: 'Assumptions' },
  { to: '/insights', label: 'Insights' },
  { to: '/settings', label: 'Settings' },
]

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand-block">
          <NavLink to="/" className="brand">
            BranchBack
          </NavLink>
          <p className="brand-tag">Decision replay laboratory</p>
        </div>
        <nav className="nav" aria-label="Primary">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main id="main" className="main">
        {children}
      </main>
      <footer className="footer">
        <p>
          Local-first. No accounts. Preserve what you believed{' '}
          <em>before</em> you knew the outcome.
        </p>
      </footer>
    </div>
  )
}
