import { cn } from '../lib/cn';
import type { JobStats, JobStatus } from '../lib/types';

const CARDS: Array<{ key: 'all' | JobStatus; label: string; hint: string }> = [
  { key: 'all', label: 'All jobs', hint: 'Entire queue' },
  { key: 'pending', label: 'Waiting', hint: 'Ready to start' },
  { key: 'running', label: 'Running', hint: 'In progress' },
  { key: 'completed', label: 'Finished', hint: 'Done successfully' },
  { key: 'failed', label: 'Failed', hint: 'Needs a look' },
];

interface MetricBarProps {
  stats: JobStats;
  active: 'all' | JobStatus;
  onChange: (status: 'all' | JobStatus) => void;
}

export function MetricBar({ stats, active, onChange }: MetricBarProps) {
  return (
    <section className="metrics" aria-label="Job counts">
      {CARDS.map((card) => {
        const selected = active === card.key;
        return (
          <button
            key={card.key}
            type="button"
            className={cn(
              'metric',
              `metric--${card.key}`,
              selected && 'metric--active',
            )}
            onClick={() => onChange(card.key)}
            aria-pressed={selected}
          >
            <span className="metric__label">{card.label}</span>
            <span className="metric__value">{stats[card.key]}</span>
            <span className="metric__hint">{card.hint}</span>
          </button>
        );
      })}
    </section>
  );
}
