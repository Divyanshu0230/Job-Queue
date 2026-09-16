import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  bulkStartJobs,
  cloneJob,
  createJob,
  deleteJob,
  fetchActivity,
  fetchJob,
  fetchJobs,
  fetchOverview,
  updateJob,
  updateJobStatus,
} from '../lib/api';
import type { Job, JobPriority, JobStatus, JobType, JobsQuery, JobsResponse } from '../lib/types';

export function jobsQueryKey(query: JobsQuery) {
  return ['jobs', query] as const;
}

function invalidateWorkspace(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: ['jobs'] });
  void queryClient.invalidateQueries({ queryKey: ['overview'] });
  void queryClient.invalidateQueries({ queryKey: ['activity'] });
}

export function useJobs(query: JobsQuery, live: boolean) {
  return useQuery({
    queryKey: jobsQueryKey(query),
    queryFn: () => fetchJobs(query),
    placeholderData: keepPreviousData,
    refetchInterval: live ? false : 4000,
    refetchOnWindowFocus: true,
  });
}

export function useJob(id: string | null) {
  return useQuery({
    queryKey: ['job', id],
    queryFn: () => fetchJob(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createJob,
    onSuccess: () => invalidateWorkspace(queryClient),
  });
}

function patchJobInLists(queryClient: QueryClient, job: Job) {
  queryClient.setQueriesData({ queryKey: ['jobs'] }, (current: JobsResponse | undefined) => {
    if (!current) return current;
    return {
      ...current,
      data: current.data.map((item) => (item.id === job.id ? { ...item, ...job } : item)),
    };
  });
  queryClient.setQueryData(['job', job.id], job);
}

export function useUpdateStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      status: JobStatus;
      expectedVersion?: number;
    }) => updateJobStatus(input.id, input.status, input.expectedVersion),
    onSuccess: (job) => {
      patchJobInLists(queryClient, job);
      invalidateWorkspace(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteJob,
    onSuccess: () => invalidateWorkspace(queryClient),
  });
}

export function useCloneJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cloneJob,
    onSuccess: () => invalidateWorkspace(queryClient),
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      title?: string;
      priority?: JobPriority;
      notes?: string;
    }) => updateJob(id, input),
    onSuccess: (job) => {
      patchJobInLists(queryClient, job);
      invalidateWorkspace(queryClient);
      void queryClient.invalidateQueries({ queryKey: ['job', job.id] });
    },
  });
}

export function useBulkStart() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkStartJobs,
    onSuccess: () => invalidateWorkspace(queryClient),
  });
}

export function useOverview(live: boolean) {
  return useQuery({
    queryKey: ['overview'],
    queryFn: fetchOverview,
    refetchInterval: live ? false : 4000,
  });
}

export function useActivity(live: boolean) {
  return useQuery({
    queryKey: ['activity'],
    queryFn: fetchActivity,
    refetchInterval: live ? false : 4000,
  });
}

export function emptyStats() {
  return {
    all: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
  };
}

export const typeLabel: Record<JobType, string> = {
  email: 'Email',
  report: 'Report',
  ingest: 'Ingest',
  webhook: 'Webhook',
  cleanup: 'Cleanup',
};

export const priorityLabel: Record<JobPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
};
