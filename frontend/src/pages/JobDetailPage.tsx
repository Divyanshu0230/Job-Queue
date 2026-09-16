import { Link, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PriorityBadge, StatusBadge } from '../components/ui';
import { useJobActions } from '../hooks/useJobActions';
import { priorityLabel, typeLabel, useDeleteJob, useJob, useUpdateJob } from '../hooks/useJobs';
import { useToasts } from '../hooks/useToasts';
import { useWatchlist } from '../hooks/useWatchlist';
import { cn } from '../lib/cn';
import { formatAbsolute, shortId, statusWord } from '../lib/format';
import { canRunAgain } from '../lib/job-actions';
import { PRIORITIES, type Job, type JobPriority, type JobStatus } from '../lib/types';
import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';

const STEPS: JobStatus[] = ['pending', 'running', 'completed'];

export function JobDetailPage() {
  const { id } = useParams();
  const jobQuery = useJob(id ?? null);
  const job = jobQuery.data;
  const { changeStatus, duplicate, busyId } = useJobActions();
  const removeJob = useDeleteJob();
  const saveJob = useUpdateJob();
  const { push } = useToasts();
  const navigate = useNavigate();
  const watchlist = useWatchlist();
  const [pendingDelete, setPendingDelete] = useState<Job | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<JobPriority>('normal');

  useEffect(() => {
    if (!job) return;
    setTitle(job.title);
    setNotes(job.notes ?? '');
    setPriority(job.priority ?? 'normal');
  }, [job]);

  if (jobQuery.isError) {
    return (
      <div className="page">
        <div className="panel error-panel">
          <h2>Job not found</h2>
          <p>It may have been deleted.</p>
          <Link to="/queue" className="primary-btn">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }

  const watched = job ? watchlist.isWatched(job.id) : false;

  return (
    <div className="page">
      <Link to="/queue" className="back-link">
        ← All jobs
      </Link>

      <div className="page-head">
        <div>
          <p className="eyebrow">Job</p>
          <h1>{job?.title ?? 'Loading…'}</h1>
          {job ? (
            <div className="drawer__meta">
              <StatusBadge status={job.status} />
              <PriorityBadge priority={job.priority ?? 'normal'} />
              <span className="type-chip">{typeLabel[job.type]}</span>
              <code className="id-copy">{shortId(job.id)}</code>
            </div>
          ) : null}
        </div>
        {job ? (
          <button
            type="button"
            className={cn('ghost-btn', watched && 'is-starred')}
            onClick={() => watchlist.toggle(job.id)}
          >
            <Star size={16} fill={watched ? 'currentColor' : 'none'} />
            {watched ? 'Watching' : 'Watch'}
          </button>
        ) : null}
      </div>

      {jobQuery.isLoading && !job ? <div className="drawer__skeleton" /> : null}

      {job ? (
        <div className="detail-grid">
          <section className="panel pad">
            <p className="eyebrow">Progress</p>
            <ol className="lifecycle-list">
              {STEPS.map((step, index) => {
                const reached =
                  job.status === step ||
                  (step === 'pending' && job.status !== 'pending') ||
                  (step === 'running' &&
                    (job.status === 'running' ||
                      job.status === 'completed' ||
                      job.status === 'failed'));
                return (
                  <li
                    key={step}
                    className={cn(reached && 'is-reached', job.status === step && 'is-current')}
                  >
                    <span>{index + 1}</span>
                    <strong>{statusWord[step]}</strong>
                  </li>
                );
              })}
              <li className={cn(job.status === 'failed' && 'is-current is-failed')}>
                <span>!</span>
                <strong>Failed</strong>
              </li>
            </ol>
            <p className="muted">
              {job.status === 'completed' || job.status === 'failed'
                ? 'This job is finished. Queue it again if you need another run.'
                : 'Move it forward when the work is ready.'}
            </p>
            <div className="drawer__actions">
              {job.status === 'pending' ? (
                <>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busyId === job.id}
                    onClick={() => void changeStatus(job, 'running')}
                  >
                    Start job
                  </button>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => void changeStatus(job, 'failed')}
                  >
                    Cancel
                  </button>
                </>
              ) : null}
              {job.status === 'running' ? (
                <>
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={busyId === job.id}
                    onClick={() => void changeStatus(job, 'completed')}
                  >
                    Mark finished
                  </button>
                  <button
                    type="button"
                    className="danger-btn"
                    onClick={() => void changeStatus(job, 'failed')}
                  >
                    Mark failed
                  </button>
                </>
              ) : null}
              {canRunAgain(job) ? (
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() =>
                    void duplicate(job).then((copy) => {
                      if (copy) navigate(`/queue/${copy.id}`);
                    })
                  }
                >
                  Queue again
                </button>
              ) : null}
              <button type="button" className="ghost-btn" onClick={() => setPendingDelete(job)}>
                Delete
              </button>
            </div>
          </section>

          <section className="panel pad">
            <p className="eyebrow">Times</p>
            <dl className="facts">
              <div>
                <dt>Created</dt>
                <dd>{formatAbsolute(job.createdAt)}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatAbsolute(job.startedAt)}</dd>
              </div>
              <div>
                <dt>Finished</dt>
                <dd>{formatAbsolute(job.finishedAt)}</dd>
              </div>
              <div>
                <dt>Type</dt>
                <dd>{typeLabel[job.type]}</dd>
              </div>
            </dl>
            <p className="eyebrow">History</p>
            {(job.events?.length ?? 0) === 0 ? (
              <p className="muted">No status changes yet.</p>
            ) : (
              <ul className="timeline">
                {job.events?.map((event) => (
                  <li key={event.id}>
                    <span>
                      {statusWord[event.fromStatus]} → {statusWord[event.toStatus]}
                    </span>
                    <time>{formatAbsolute(event.createdAt)}</time>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}

      {job ? (
        <section className="panel pad">
          <p className="eyebrow">Details</p>
            <h2>Notes for the team</h2>
          <div className="detail-form">
            <label className="field">
              <span>Title</span>
              <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label className="field">
              <span>Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as JobPriority)}
              >
                {PRIORITIES.map((item) => (
                  <option key={item} value={item}>
                    {priorityLabel[item]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field field--full">
              <span>Notes</span>
              <textarea
                rows={4}
                maxLength={400}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Anything the next person should know"
              />
            </label>
          </div>
          <button
            type="button"
            className="primary-btn"
            disabled={saveJob.isPending}
            onClick={() => {
              void saveJob
                .mutateAsync({ id: job.id, title: title.trim(), notes: notes.trim(), priority })
                .then(() => push({ tone: 'ok', title: 'Details saved', detail: title.trim() }));
            }}
          >
            Save details
          </button>
        </section>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this job?"
        body={pendingDelete ? `${pendingDelete.title} will be removed.` : ''}
        pending={removeJob.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          void removeJob.mutateAsync(pendingDelete.id).then(() => {
            push({ tone: 'ok', title: 'Job deleted', detail: pendingDelete.title });
            navigate('/queue');
          });
        }}
      />
    </div>
  );
}
