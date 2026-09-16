import type {
  ActivityItem,
  ApiErrorBody,
  Job,
  JobPriority,
  JobStatus,
  JobType,
  JobsQuery,
  JobsResponse,
  Overview,
} from './types';

export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(
  /\/$/,
  '',
) ?? '';

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    const message = Array.isArray(body.message)
      ? body.message.join(', ')
      : body.message || 'Request failed';
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function url(path: string, params?: Record<string, string | number | undefined>) {
  const target = `${API_BASE}${path}`;
  if (!params) return target;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '' && value !== 'all') {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `${target}?${qs}` : target;
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  const data = text ? (JSON.parse(text) as ApiErrorBody & T) : ({} as ApiErrorBody & T);
  if (!response.ok) {
    const message = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message || response.statusText;
    throw new ApiError(response.status, {
      statusCode: data.statusCode ?? response.status,
      error: data.error,
      code: data.code,
      message,
      currentStatus: data.currentStatus,
      requestedStatus: data.requestedStatus,
      allowedTransitions: data.allowedTransitions,
      currentVersion: data.currentVersion,
      requestId: data.requestId,
    });
  }
  return data as T;
}

export async function fetchJobs(query: JobsQuery): Promise<JobsResponse> {
  const response = await fetch(
    url('/jobs', {
      status: query.status,
      type: query.type,
      priority: query.priority,
      attention: query.attention ? 'true' : undefined,
      sort: query.sort,
      search: query.search,
      page: query.page ?? 1,
      limit: query.limit ?? 50,
    }),
  );
  return parse<JobsResponse>(response);
}

export async function fetchJob(id: string): Promise<Job> {
  const response = await fetch(url(`/jobs/${id}`));
  return parse<Job>(response);
}

export async function createJob(input: {
  title: string;
  type: JobType;
  priority?: JobPriority;
  notes?: string;
}): Promise<Job> {
  const response = await fetch(url('/jobs'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parse<Job>(response);
}

export async function updateJob(
  id: string,
  input: { title?: string; priority?: JobPriority; notes?: string },
): Promise<Job> {
  const response = await fetch(url(`/jobs/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  return parse<Job>(response);
}

export async function bulkStartJobs(ids: string[]): Promise<{ started: number; skipped: number }> {
  const response = await fetch(url('/jobs/bulk-start'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return parse(response);
}

export async function updateJobStatus(
  id: string,
  status: JobStatus,
  expectedVersion?: number,
): Promise<Job> {
  const response = await fetch(url(`/jobs/${id}/status`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, expectedVersion }),
  });
  return parse<Job>(response);
}

export async function deleteJob(id: string): Promise<void> {
  const response = await fetch(url(`/jobs/${id}`), { method: 'DELETE' });
  await parse<void>(response);
}

export async function fetchHealth(): Promise<{ status: string; database: string }> {
  const response = await fetch(url('/health'));
  return parse(response);
}

export async function fetchOverview(): Promise<Overview> {
  const response = await fetch(url('/jobs/overview'));
  return parse<Overview>(response);
}

export async function fetchActivity(): Promise<ActivityItem[]> {
  const response = await fetch(url('/jobs/activity'));
  return parse<ActivityItem[]>(response);
}

export async function cloneJob(id: string): Promise<Job> {
  const response = await fetch(url(`/jobs/${id}/clone`), { method: 'POST' });
  return parse<Job>(response);
}

export function streamUrl(): string {
  return url('/jobs/stream');
}
