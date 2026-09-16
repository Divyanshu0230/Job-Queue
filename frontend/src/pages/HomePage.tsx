import { Link, useNavigate } from 'react-router-dom';
import { PriorityBadge, StatusBadge } from '../components/ui';
import { typeLabel, useOverview } from '../hooks/useJobs';
import { useWorkspace } from '../hooks/useWorkspace';
import { activityLine, formatDuration, relativeTime } from '../lib/format';
import type { JobType } from '../lib/types';

const TYPE_ORDER: JobType[] = ['email', 'report', 'ingest', 'webhook', 'cleanup'];

export function HomePage() {
  const { openCreate, live } = useWorkspace();
  const overview = useOverview(live);
  const navigate = useNavigate();
  const data = overview.data;
  const stats = data?.stats;
  const maxType = Math.max(1, ...TYPE_ORDER.map((key) => data?.typeBreakdown[key] ?? 0));
  const attention = [...(data?.failedJobs ?? []), ...(data?.waitingJobs ?? [])];

  if (overview.isLoading && !data) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <p className="eyebrow">Home</p>
            <h1>Loading dashboard…</h1>
          </div>
        </div>
        <div className="panel">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton-row" />
          ))}
        </div>
      </div>
    );
  }

  if (overview.isError) {
    return (
      <div className="panel error-panel">
        <h2>Could not load the dashboard</h2>
        <p>Check that the service is running, then retry.</p>
        <button type="button" className="primary-btn" onClick={() => void overview.refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Home</p>
          <h1>Overview</h1>
          <p className="lede">
            This is a job queue dashboard. Create work, start it, and watch it finish —
            mail, reports, imports, and cleanups in one place.
          </p>
        </div>
        <div className="page-head__actions">
          <Link to="/queue" className="ghost-btn">
            View all jobs
          </Link>
          <button type="button" className="primary-btn" onClick={openCreate}>
            New job
          </button>
        </div>
      </div>

      <section className="kpi-grid">
        <button type="button" className="kpi kpi--btn" onClick={() => navigate('/queue')}>
          <span>In queue</span>
          <strong>{stats?.all ?? '—'}</strong>
          <small>
            {stats?.pending ?? 0} waiting · {stats?.running ?? 0} running
          </small>
        </button>
        <button type="button" className="kpi kpi--btn" onClick={() => navigate('/queue?status=completed')}>
          <span>Finished today</span>
          <strong>{data?.finishedToday ?? '—'}</strong>
          <small>{data?.createdToday ?? 0} created today</small>
        </button>
        <button type="button" className="kpi kpi--btn" onClick={() => navigate('/queue?attention=1')}>
          <span>Needs a look</span>
          <strong className="is-rose">{data?.attentionCount ?? '—'}</strong>
          <small>Failed or waiting too long</small>
        </button>
        <article className="kpi">
          <span>Success rate</span>
          <strong className="is-emerald">
            {data?.successRate !== null && data?.successRate !== undefined
              ? `${data.successRate}%`
              : '—'}
          </strong>
          <small>Avg run {formatDuration(data?.avgDurationSeconds)}</small>
        </article>
      </section>

      {attention.length > 0 ? (
        <section className="panel">
          <div className="section-head pad-x">
            <h2>Needs a look</h2>
            <Link to="/queue?attention=1">Open list</Link>
          </div>
          <div className="recent-list">
            {attention.slice(0, 6).map((job) => (
              <Link key={job.id} to={`/queue/${job.id}`} className="recent-row">
                <div>
                  <strong>{job.title}</strong>
                  <span className="muted">
                    {job.status === 'failed' ? 'Failed' : 'Waiting too long'} · {relativeTime(job.createdAt)}
                  </span>
                </div>
                <div className="recent-row__tags">
                  <PriorityBadge priority={job.priority ?? 'normal'} />
                  <StatusBadge status={job.status} />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <div className="dash-grid">
        <section className="panel pad">
          <div className="section-head">
            <h2>Queue mix</h2>
            <Link to="/queue">Open jobs</Link>
          </div>
          <div className="stack-bars">
            {(['pending', 'running', 'completed', 'failed'] as const).map((status) => {
              const value = stats?.[status] ?? 0;
              const total = stats?.all || 1;
              const label =
                status === 'pending'
                  ? 'Waiting'
                  : status === 'completed'
                    ? 'Finished'
                    : status === 'failed'
                      ? 'Failed'
                      : 'Running';
              return (
                <button
                  key={status}
                  type="button"
                  className={`stack-row stack-row--${status}`}
                  onClick={() => navigate(`/queue?status=${status}`)}
                >
                  <span>{label}</span>
                  <span className="bar">
                    <i style={{ width: `${(value / total) * 100}%` }} />
                  </span>
                  <b>{value}</b>
                </button>
              );
            })}
          </div>
          <div className="type-bars">
            {TYPE_ORDER.map((type) => (
              <button
                key={type}
                type="button"
                className="type-bar"
                onClick={() => navigate(`/queue?type=${type}`)}
              >
                <span>
                  {typeLabel[type]}
                  <b>{data?.typeBreakdown[type] ?? 0}</b>
                </span>
                <span className="bar">
                  <i
                    style={{
                      width: `${((data?.typeBreakdown[type] ?? 0) / maxType) * 100}%`,
                    }}
                  />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel pad">
          <div className="section-head">
            <h2>Latest activity</h2>
            <Link to="/activity">See all</Link>
          </div>
          {(data?.activity.length ?? 0) === 0 ? (
            <p className="muted">New jobs will show up here as they move.</p>
          ) : (
            <ul className="feed">
              {data?.activity.map((item) => (
                <li key={item.id}>
                  <Link to={`/queue/${item.jobId}`}>
                    {activityLine(item.jobTitle, item.toStatus)}
                  </Link>
                  <time>{relativeTime(item.createdAt)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="section-head pad-x">
          <h2>Recent jobs</h2>
          <Link to="/queue">View queue</Link>
        </div>
        <div className="recent-list">
          {(data?.recentJobs ?? []).map((job) => (
            <Link key={job.id} to={`/queue/${job.id}`} className="recent-row">
              <div>
                <strong>{job.title}</strong>
                <span className="muted">
                  {typeLabel[job.type]} · {relativeTime(job.createdAt)}
                </span>
              </div>
              <div className="recent-row__tags">
                <PriorityBadge priority={job.priority ?? 'normal'} />
                <StatusBadge status={job.status} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
