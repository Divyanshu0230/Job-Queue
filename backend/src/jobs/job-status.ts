export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum JobType {
  EMAIL = 'email',
  REPORT = 'report',
  INGEST = 'ingest',
  WEBHOOK = 'webhook',
  CLEANUP = 'cleanup',
}

export enum JobPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export const PRIORITY_RANK: Record<JobPriority, number> = {
  [JobPriority.URGENT]: 0,
  [JobPriority.HIGH]: 1,
  [JobPriority.NORMAL]: 2,
  [JobPriority.LOW]: 3,
};

/**
 * Canonical lifecycle:
 *   pending → running → completed
 *                  ↘ failed
 *
 * pending → failed is also allowed so an operator can cancel a job
 * that has not started yet. Terminal states never move backwards.
 */
export const ALLOWED_TRANSITIONS: Record<JobStatus, readonly JobStatus[]> = {
  [JobStatus.PENDING]: [JobStatus.RUNNING, JobStatus.FAILED],
  [JobStatus.RUNNING]: [JobStatus.COMPLETED, JobStatus.FAILED],
  [JobStatus.COMPLETED]: [],
  [JobStatus.FAILED]: [],
};

export function allowedTransitions(status: JobStatus): JobStatus[] {
  return [...ALLOWED_TRANSITIONS[status]];
}

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: JobStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}
