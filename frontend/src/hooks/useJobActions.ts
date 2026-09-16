import { ApiError } from '../lib/api';
import type { Job, JobStatus } from '../lib/types';
import { useCloneJob, useDeleteJob, useUpdateStatus } from './useJobs';
import { useToasts } from './useToasts';

export function useJobActions() {
  const { push } = useToasts();
  const updateStatus = useUpdateStatus();
  const removeJob = useDeleteJob();
  const cloneJob = useCloneJob();

  async function changeStatus(job: Job, next: JobStatus) {
    try {
      await updateStatus.mutateAsync({
        id: job.id,
        status: next,
        expectedVersion: job.version,
      });
      push({
        tone: next === 'failed' ? 'warn' : 'ok',
        title:
          next === 'running'
            ? 'Job started'
            : next === 'completed'
              ? 'Job completed'
              : 'Job marked failed',
        detail: job.title,
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        push({
          tone: 'warn',
          title: 'This job was already updated',
          detail: 'Showing the latest status now.',
        });
        return;
      }
      push({
        tone: 'danger',
        title: 'Could not update job',
        detail: error instanceof Error ? error.message : 'Please try again',
      });
    }
  }

  async function duplicate(job: Job) {
    try {
      const copy = await cloneJob.mutateAsync(job.id);
      push({
        tone: 'ok',
        title: 'Queued again',
        detail: copy.title,
      });
      return copy;
    } catch (error) {
      push({
        tone: 'danger',
        title: 'Could not queue again',
        detail: error instanceof Error ? error.message : 'Please try again',
      });
      return null;
    }
  }

  return {
    changeStatus,
    duplicate,
    removeJob,
    busyId: updateStatus.isPending ? updateStatus.variables?.id ?? null : null,
    cloning: cloneJob.isPending,
    deleting: removeJob.isPending,
  };
}
