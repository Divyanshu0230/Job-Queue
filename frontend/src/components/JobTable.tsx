import {
  Ban,
  Check,
  Copy,
  Database,
  Mail,
  Play,
  Radio,
  Star,
  Trash2,
  LineChart,
} from 'lucide-react';
import { typeLabel } from '../hooks/useJobs';
import { cn } from '../lib/cn';
import { formatAbsolute, relativeTime, shortId } from '../lib/format';
import { canRunAgain, nextActions } from '../lib/job-actions';
import type { Job, JobStatus, JobType } from '../lib/types';
import { PriorityBadge, StatusBadge } from './ui';

const typeIcon: Record<JobType, typeof Mail> = {
  email: Mail,
  report: LineChart,
  ingest: Database,
  webhook: Radio,
  cleanup: Trash2,
};

interface JobTableProps {
  jobs: Job[];
  loading: boolean;
  selectedId: string | null;
  selectedIds: string[];
  watchedIds: string[];
  busyId: string | null;
  onOpen: (id: string) => void;
  onTransition: (job: Job, status: JobStatus) => void;
  onDelete: (job: Job) => void;
  onClone?: (job: Job) => void;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onWatch: (id: string) => void;
}

export function JobTable({
  jobs,
  loading,
  selectedId,
  selectedIds,
  watchedIds,
  busyId,
  onOpen,
  onTransition,
  onDelete,
  onClone,
  onToggle,
  onToggleAll,
  onWatch,
}: JobTableProps) {
  if (loading) {
    return (
      <div className="panel">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton-row" />
        ))}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="panel empty">
        <p className="empty__title">No jobs in this view</p>
        <p className="empty__copy">Create a job, or clear the filters at the top.</p>
      </div>
    );
  }

  const allSelected = jobs.every((job) => selectedIds.includes(job.id));

  return (
    <div className="panel table-wrap">
      <table className="jobs">
        <thead>
          <tr>
            <th className="jobs__check">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label="Select all jobs on this page"
              />
            </th>
            <th>Job</th>
            <th>Type</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => {
            const Icon = typeIcon[job.type];
            const actions = nextActions[job.status];
            const watched = watchedIds.includes(job.id);
            return (
              <tr
                key={job.id}
                className={cn(selectedId === job.id && 'is-selected')}
                onClick={() => onOpen(job.id)}
              >
                <td className="jobs__check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(job.id)}
                    onChange={() => onToggle(job.id)}
                    aria-label={`Select ${job.title}`}
                  />
                </td>
                <td>
                  <button type="button" className="job-title" onClick={() => onOpen(job.id)}>
                    <span>{job.title}</span>
                    <code>{shortId(job.id)}</code>
                  </button>
                </td>
                <td>
                  <span className="type-chip">
                    <Icon size={13} />
                    {typeLabel[job.type]}
                  </span>
                </td>
                <td>
                  <PriorityBadge priority={job.priority ?? 'normal'} />
                </td>
                <td>
                  <StatusBadge status={job.status} />
                </td>
                <td title={formatAbsolute(job.createdAt)} className="muted">
                  {relativeTime(job.createdAt)}
                </td>
                <td>
                  <div className="row-actions" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className={cn('icon-btn', watched && 'is-starred')}
                      aria-label={watched ? 'Remove from watch list' : 'Watch this job'}
                      onClick={() => onWatch(job.id)}
                    >
                      <Star size={14} fill={watched ? 'currentColor' : 'none'} />
                    </button>
                    {actions.map((action) => (
                      <button
                        key={action.status}
                        type="button"
                        className={cn('chip-btn', action.tone === 'bad' && 'chip-btn--bad')}
                        disabled={busyId === job.id}
                        onClick={() => onTransition(job, action.status)}
                      >
                        {action.status === 'running' ? (
                          <Play size={12} />
                        ) : action.status === 'completed' ? (
                          <Check size={12} />
                        ) : (
                          <Ban size={12} />
                        )}
                        {action.label}
                      </button>
                    ))}
                    {onClone && canRunAgain(job) ? (
                      <button type="button" className="chip-btn" onClick={() => onClone(job)}>
                        <Copy size={12} />
                        Again
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Delete ${job.title}`}
                      onClick={() => onDelete(job)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
