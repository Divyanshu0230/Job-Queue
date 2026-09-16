import type { Job, JobStatus } from './types';

export const nextActions: Record<
  JobStatus,
  Array<{ status: JobStatus; label: string; tone: 'go' | 'bad' }>
> = {
  pending: [
    { status: 'running', label: 'Start', tone: 'go' },
    { status: 'failed', label: 'Cancel', tone: 'bad' },
  ],
  running: [
    { status: 'completed', label: 'Complete', tone: 'go' },
    { status: 'failed', label: 'Fail', tone: 'bad' },
  ],
  completed: [],
  failed: [],
};

export function canRunAgain(job: Job): boolean {
  return job.status === 'completed' || job.status === 'failed';
}
