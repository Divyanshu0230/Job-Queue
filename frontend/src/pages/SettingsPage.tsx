import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTheme } from '../hooks/useTheme';
import { cn } from '../lib/cn';
import { Kbd } from '../components/ui';

const NAME_KEY = 'dispatch.operator';
const DENSITY_KEY = 'dispatch.density';

export type Density = 'comfortable' | 'compact';

export function readDensity(): Density {
  return localStorage.getItem(DENSITY_KEY) === 'compact' ? 'compact' : 'comfortable';
}

export function SettingsPage({
  operator,
  onOperator,
}: {
  operator: string;
  onOperator: (name: string) => void;
}) {
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState(operator);
  const [density, setDensity] = useState<Density>(() =>
    typeof window === 'undefined' ? 'comfortable' : readDensity(),
  );

  useEffect(() => {
    setName(operator);
  }, [operator]);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    localStorage.setItem(DENSITY_KEY, density);
  }, [density]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Your workspace</h1>
          <p className="lede">How this dashboard looks on this computer. Nothing here is shared with anyone else.</p>
        </div>
      </div>

      <section className="panel pad settings-card">
        <h2>What is this app?</h2>
        <p className="muted">
          Mini Job Queue Dashboard — create a job, start it when you are ready, then mark it
          finished or failed. Home, Jobs, Activity, and Settings are all part of the same queue.
        </p>
      </section>

      <section className="panel pad settings-card">
        <h2>Appearance</h2>
        <p className="muted">Day mode is light. Night mode is dark. Text, buttons, and tables stay readable in both.</p>
        <div className="theme-picks">
          <button
            type="button"
            className={cn('theme-pick theme-pick--day', theme === 'light' && 'is-active')}
            onClick={() => setTheme('light')}
          >
            <Sun size={18} />
            Day
          </button>
          <button
            type="button"
            className={cn('theme-pick theme-pick--night', theme === 'dark' && 'is-active')}
            onClick={() => setTheme('dark')}
          >
            <Moon size={18} />
            Night
          </button>
        </div>
      </section>

      <section className="panel pad settings-card">
        <h2>Table size</h2>
        <p className="muted">Compact shows more jobs on screen.</p>
        <div className="theme-picks">
          <button
            type="button"
            className={cn('theme-pick', density === 'comfortable' && 'is-active')}
            onClick={() => setDensity('comfortable')}
          >
            Comfortable
          </button>
          <button
            type="button"
            className={cn('theme-pick', density === 'compact' && 'is-active')}
            onClick={() => setDensity('compact')}
          >
            Compact
          </button>
        </div>
      </section>

      <section className="panel pad settings-card">
        <h2>Display name</h2>
        <label className="field">
          <span>Shown on the home screen</span>
          <input
            value={name}
            maxLength={40}
            onChange={(event) => setName(event.target.value)}
            onBlur={() => {
              const next = name.trim() || 'You';
              onOperator(next);
              localStorage.setItem(NAME_KEY, next);
            }}
          />
        </label>
      </section>

      <section className="panel pad settings-card">
        <h2>Shortcuts</h2>
        <ul className="shortcut-list">
          <li>
            <Kbd>N</Kbd> New job
          </li>
          <li>
            <Kbd>/</Kbd> Search jobs
          </li>
          <li>
            <Kbd>?</Kbd> Open this list
          </li>
        </ul>
      </section>
    </div>
  );
}

export function readOperator(): string {
  return localStorage.getItem(NAME_KEY) || 'You';
}
