import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/ui';
import { typeLabel, useActivity } from '../hooks/useJobs';
import { useWorkspace } from '../hooks/useWorkspace';
import { cn } from '../lib/cn';
import { activityLine, formatAbsolute, relativeTime, statusWord } from '../lib/format';
import type { JobStatus } from '../lib/types';

const FILTERS: Array<{ id: 'all' | JobStatus; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Started' },
  { id: 'completed', label: 'Finished' },
  { id: 'failed', label: 'Failed' },
];

export function ActivityPage() {
  const { live } = useWorkspace();
  const activity = useActivity(live);
  const [filter, setFilter] = useState<'all' | JobStatus>('all');
  const rows = useMemo(
    () =>
      (activity.data ?? []).filter((item) => (filter === 'all' ? true : item.toStatus === filter)),
    [activity.data, filter],
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Activity</p>
          <h1>What changed</h1>
          <p className="lede">A running log of jobs as they start, finish, or fail.</p>
        </div>
      </div>

      <div className="filter-row">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn('chip-btn', filter === item.id && 'is-active')}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="panel">
        {activity.isLoading ? <div className="drawer__skeleton" /> : null}
        {rows.length === 0 && !activity.isLoading ? (
          <p className="empty__copy pad">Nothing in this view yet. Start a job to see updates.</p>
        ) : (
          <ul className="activity-list">
            {rows.map((item) => (
              <li key={item.id}>
                <Link to={`/queue/${item.jobId}`} className="activity-row">
                  <div>
                    <strong>{activityLine(item.jobTitle, item.toStatus)}</strong>
                    <span className="muted">
                      {typeLabel[item.jobType]} · {statusWord[item.fromStatus]} →{' '}
                      {statusWord[item.toStatus]} · {formatAbsolute(item.createdAt)}
                    </span>
                  </div>
                  <div className="activity-row__meta">
                    <StatusBadge status={item.toStatus} />
                    <time>{relativeTime(item.createdAt)}</time>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
