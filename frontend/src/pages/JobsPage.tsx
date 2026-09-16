import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { JobTable } from '../components/JobTable';
import { JobToolbar } from '../components/JobToolbar';
import { MetricBar } from '../components/MetricBar';
import { useJobActions } from '../hooks/useJobActions';
import { emptyStats, useBulkStart, useDeleteJob, useJobs } from '../hooks/useJobs';
import { useWatchlist } from '../hooks/useWatchlist';
import { useWorkspace } from '../hooks/useWorkspace';
import { useToasts } from '../hooks/useToasts';
import type { Job, JobPriority, JobSort, JobStatus, JobType } from '../lib/types';

function exportCsv(jobs: Job[]) {
  const header = ['Title', 'Type', 'Status', 'Priority', 'Created', 'Notes'];
  const rows = jobs.map((job) =>
    [job.title, job.type, job.status, job.priority, job.createdAt, job.notes ?? '']
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...rows].join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = 'dispatch-jobs.csv';
  link.click();
  URL.revokeObjectURL(href);
}

export function JobsPage() {
  const { live, openCreate } = useWorkspace();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { push } = useToasts();
  const { changeStatus, duplicate, busyId } = useJobActions();
  const removeJob = useDeleteJob();
  const bulkStart = useBulkStart();
  const watchlist = useWatchlist();
  const [search, setSearch] = useState(params.get('q') ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<Job | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [watchedOnly, setWatchedOnly] = useState(false);

  const status = (params.get('status') as JobStatus | 'all' | null) ?? 'all';
  const type = (params.get('type') as JobType | 'all' | null) ?? 'all';
  const priority = (params.get('priority') as JobPriority | 'all' | null) ?? 'all';
  const sort = (params.get('sort') as JobSort | null) ?? 'newest';
  const attention = params.get('attention') === '1';

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(search), 250);
    return () => window.clearTimeout(handle);
  }, [search]);

  useEffect(() => {
    setSearch(params.get('q') ?? '');
  }, [params]);

  useEffect(() => {
    setPage(1);
    setSelectedIds([]);
  }, [status, type, debouncedSearch, priority, sort, attention, watchedOnly]);

  const query = useMemo(
    () => ({
      status: attention ? 'all' : status,
      type,
      priority,
      attention,
      sort,
      search: debouncedSearch,
      page,
      limit: 50,
    }),
    [status, type, priority, attention, sort, debouncedSearch, page],
  );

  const jobsQuery = useJobs(query, live);
  const stats = jobsQuery.data?.stats ?? emptyStats();
  const jobs = (jobsQuery.data?.data ?? []).filter((job) =>
    watchedOnly ? watchlist.isWatched(job.id) : true,
  );
  const meta = jobsQuery.data?.meta;

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    if (key === 'status' && value !== 'all') next.delete('attention');
    setParams(next);
  }

  const pendingSelected = jobs.filter(
    (job) => selectedIds.includes(job.id) && job.status === 'pending',
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <p className="eyebrow">Jobs</p>
          <h1>Queue</h1>
          <p className="lede">
            Start waiting work, finish running jobs, or queue a copy of a done job.
          </p>
        </div>
        <button type="button" className="primary-btn" onClick={openCreate}>
          New job
        </button>
      </div>

      <MetricBar
        stats={stats}
        active={attention ? 'all' : status}
        onChange={(value) => setFilter('status', value)}
      />
      <JobToolbar
        search={search}
        type={type}
        priority={priority}
        sort={sort}
        attention={attention}
        watchedOnly={watchedOnly}
        total={watchedOnly ? jobs.length : meta?.total ?? 0}
        onSearch={(value) => {
          setSearch(value);
          const next = new URLSearchParams(params);
          if (value) next.set('q', value);
          else next.delete('q');
          setParams(next, { replace: true });
        }}
        onType={(value) => setFilter('type', value)}
        onPriority={(value) => setFilter('priority', value)}
        onSort={(value) => setFilter('sort', value)}
        onAttention={(value) => {
          const next = new URLSearchParams(params);
          if (value) {
            next.set('attention', '1');
            next.delete('status');
          } else next.delete('attention');
          setParams(next);
        }}
        onWatchedOnly={setWatchedOnly}
        onExport={() => exportCsv(jobs)}
      />

      {selectedIds.length > 0 ? (
        <div className="bulk-bar">
          <span>{selectedIds.length} selected</span>
          <button
            type="button"
            className="primary-btn"
            disabled={pendingSelected.length === 0 || bulkStart.isPending}
            onClick={() => {
              void bulkStart
                .mutateAsync(pendingSelected.map((job) => job.id))
                .then((result) => {
                  push({
                    tone: 'ok',
                    title: `Started ${result.started} job${result.started === 1 ? '' : 's'}`,
                    detail:
                      result.skipped > 0
                        ? `${result.skipped} were already moving`
                        : pendingSelected[0]?.title,
                  });
                  setSelectedIds([]);
                });
            }}
          >
            Start waiting
          </button>
          <button type="button" className="ghost-btn" onClick={() => setSelectedIds([])}>
            Clear
          </button>
        </div>
      ) : null}

      {jobsQuery.isError ? (
        <div className="panel error-panel">
          <h2>Could not load jobs</h2>
          <p>
            {jobsQuery.error instanceof Error
              ? jobsQuery.error.message
              : 'The service is unreachable.'}
          </p>
          <button type="button" className="primary-btn" onClick={() => void jobsQuery.refetch()}>
            Retry
          </button>
        </div>
      ) : (
        <JobTable
          jobs={jobs}
          loading={jobsQuery.isLoading && !jobsQuery.data}
          selectedId={null}
          selectedIds={selectedIds}
          watchedIds={watchlist.ids}
          busyId={busyId}
          onOpen={(id) => navigate(`/queue/${id}`)}
          onTransition={changeStatus}
          onDelete={setPendingDelete}
          onClone={(job) => void duplicate(job)}
          onToggle={(id) =>
            setSelectedIds((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
          onToggleAll={() =>
            setSelectedIds((current) =>
              jobs.every((job) => current.includes(job.id)) ? [] : jobs.map((job) => job.id),
            )
          }
          onWatch={watchlist.toggle}
        />
      )}

      {meta && meta.pageCount > 1 && !watchedOnly ? (
        <div className="pager">
          <button
            type="button"
            className="ghost-btn"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </button>
          <span>
            Page {meta.page} / {meta.pageCount}
          </span>
          <button
            type="button"
            className="ghost-btn"
            disabled={page >= meta.pageCount}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this job?"
        body={
          pendingDelete ? `${pendingDelete.title} will be removed from the queue.` : ''
        }
        pending={removeJob.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          void removeJob
            .mutateAsync(pendingDelete.id)
            .then(() => {
              push({ tone: 'ok', title: 'Job deleted', detail: pendingDelete.title });
              setPendingDelete(null);
            })
            .catch((error: unknown) => {
              push({
                tone: 'danger',
                title: 'Could not delete',
                detail: error instanceof Error ? error.message : 'Please try again',
              });
            });
        }}
      />
    </div>
  );
}
