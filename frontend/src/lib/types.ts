export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type JobType = 'email' | 'report' | 'ingest' | 'webhook' | 'cleanup';
export type JobPriority = 'low' | 'normal' | 'high' | 'urgent';
export type JobSort = 'newest' | 'oldest' | 'priority';

export interface JobEvent {
  id: string;
  jobId: string;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  createdAt: string;
}

export interface Job {
  id: string;
  title: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  notes: string;
  version: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  events?: JobEvent[];
}

export interface JobStats {
  all: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export interface JobsResponse {
  data: Job[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
  stats: JobStats;
}

export interface JobsQuery {
  status?: JobStatus | 'all';
  type?: JobType | 'all';
  priority?: JobPriority | 'all';
  attention?: boolean;
  sort?: JobSort;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ActivityItem {
  id: string;
  jobId: string;
  jobTitle: string;
  jobType: JobType;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  createdAt: string;
}

export interface Overview {
  stats: JobStats;
  typeBreakdown: Record<JobType, number>;
  createdToday: number;
  finishedToday: number;
  failedToday: number;
  avgDurationSeconds: number | null;
  successRate: number | null;
  attentionCount: number;
  failedJobs: Job[];
  waitingJobs: Job[];
  recentJobs: Job[];
  activity: ActivityItem[];
}

export interface ApiErrorBody {
  statusCode: number;
  error?: string;
  code?: string;
  message: string | string[];
  currentStatus?: JobStatus;
  requestedStatus?: JobStatus;
  allowedTransitions?: JobStatus[];
  currentVersion?: number;
  requestId?: string;
}

export const JOB_TYPES: JobType[] = [
  'email',
  'report',
  'ingest',
  'webhook',
  'cleanup',
];

export const STATUSES: JobStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
];

export const PRIORITIES: JobPriority[] = ['urgent', 'high', 'normal', 'low'];
