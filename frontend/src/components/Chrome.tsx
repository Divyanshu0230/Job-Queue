import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  Bell,
  CircleHelp,
  History,
  LayoutDashboard,
  ListTodo,
  Moon,
  Plus,
  Settings,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { useActivity, useOverview } from '../hooks/useJobs';
import { useTheme } from '../hooks/useTheme';
import { useWorkspace } from '../hooks/useWorkspace';
import { relativeTime } from '../lib/format';
import { Kbd, Overlay } from './ui';

interface TopbarProps {
  live: boolean;
  apiOk: boolean | null;
}

export function MenuButton({
  label,
  onClick,
  expanded,
}: {
  label: string;
  onClick: () => void;
  expanded: boolean;
}) {
  return (
    <button
      type="button"
      className="menu-btn"
      aria-label={label}
      aria-expanded={expanded}
      aria-controls="app-sidebar"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      <span />
      <span />
      <span />
    </button>
  );
}

export function Sidebar() {
  const { live, closeSidebar } = useWorkspace();
  const overview = useOverview(live);
  const attention = overview.data?.attentionCount ?? 0;
  const navigate = useNavigate();

  function go(path: string) {
    navigate(path);
    if (window.innerWidth <= 980) closeSidebar();
  }

  return (
    <aside className="sidebar" id="app-sidebar">
      <div className="brand">
        <MenuButton label="Hide menu" expanded onClick={closeSidebar} />
        <Link
          to="/"
          className="brand--link"
          aria-label="Go to home"
          onClick={(event) => {
            event.preventDefault();
            go('/');
          }}
        >
          <div>
            <p className="brand__name">Job Queue</p>
            <p className="brand__sub">Dashboard</p>
          </div>
        </Link>
      </div>

      <nav className="side-nav" aria-label="Main">
        <NavLink to="/" end className="side-link" onClick={() => go('/')}>
          <LayoutDashboard size={16} />
          Home
        </NavLink>
        <NavLink to="/queue" className="side-link" onClick={() => window.innerWidth <= 980 && closeSidebar()}>
          <ListTodo size={16} />
          Jobs
          {attention > 0 ? <b className="nav-badge">{attention}</b> : null}
        </NavLink>
        <NavLink to="/activity" className="side-link" onClick={() => window.innerWidth <= 980 && closeSidebar()}>
          <History size={16} />
          Activity
        </NavLink>
        <NavLink to="/settings" className="side-link" onClick={() => window.innerWidth <= 980 && closeSidebar()}>
          <Settings size={16} />
          Settings
        </NavLink>
      </nav>

      <p className="sidebar__foot">Create work, start it, watch it finish.</p>
    </aside>
  );
}

export function Topbar({ live, apiOk }: TopbarProps) {
  const { openCreate, operator, sidebarOpen, toggleSidebar } = useWorkspace();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [openBell, setOpenBell] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const activity = useActivity(live);

  return (
    <header className="topbar">
      {!sidebarOpen ? <MenuButton label="Show menu" expanded={false} onClick={toggleSidebar} /> : null}
      <form
        className="search search--top"
        onSubmit={(event) => {
          event.preventDefault();
          const q = search.trim();
          navigate(q ? `/queue?q=${encodeURIComponent(q)}` : '/queue');
        }}
      >
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search jobs"
          aria-label="Search jobs"
        />
        <Kbd>/</Kbd>
      </form>

      <div className="topbar__actions">
        <div className={apiOk === false ? 'health health--down' : 'health'}>
          <Activity size={14} />
          {apiOk === false ? 'Offline' : live ? 'Live' : 'Refreshing'}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={toggle}
          aria-label={theme === 'dark' ? 'Switch to day mode' : 'Switch to night mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label="Shortcuts"
          onClick={() => setHelpOpen(true)}
        >
          <CircleHelp size={16} />
        </button>
        <div className="bell-wrap">
          <button
            type="button"
            className="icon-btn"
            aria-label="Notifications"
            onClick={() => setOpenBell((value) => !value)}
          >
            <Bell size={16} />
          </button>
          {openBell ? (
            <div className="menu-card">
              <p className="eyebrow">Recent updates</p>
              {(activity.data ?? []).slice(0, 6).length === 0 ? (
                <p className="muted">No updates yet.</p>
              ) : (
                (activity.data ?? []).slice(0, 6).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="menu-row"
                    onClick={() => {
                      setOpenBell(false);
                      navigate(`/queue/${item.jobId}`);
                    }}
                  >
                    <span>{item.jobTitle}</span>
                    <small>
                      {item.toStatus === 'completed'
                        ? 'Finished'
                        : item.toStatus === 'pending'
                          ? 'Waiting'
                          : item.toStatus === 'running'
                            ? 'Started'
                            : 'Failed'}{' '}
                      · {relativeTime(item.createdAt)}
                    </small>
                  </button>
                ))
              )}
            </div>
          ) : null}
        </div>
        <button type="button" className="primary-btn" onClick={openCreate}>
          <Plus size={16} />
          New job
          <Kbd>N</Kbd>
        </button>
        <button type="button" className="avatar" onClick={() => navigate('/settings')}>
          {operator.slice(0, 1).toUpperCase()}
        </button>
      </div>
      {helpOpen ? <ShortcutsHelp onClose={() => setHelpOpen(false)} /> : null}
    </header>
  );
}

function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="modal">
        <p className="eyebrow">Shortcuts</p>
        <h2>Faster queue work</h2>
        <ul className="shortcut-list">
          <li>
            <Kbd>N</Kbd> New job
          </li>
          <li>
            <Kbd>/</Kbd> Jump to search
          </li>
          <li>
            <Kbd>?</Kbd> Open this panel
          </li>
        </ul>
        <div className="modal__actions">
          <button type="button" className="primary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </Overlay>
  );
}
