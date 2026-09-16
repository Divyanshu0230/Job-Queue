import {
  JobStatus,
  allowedTransitions,
  canTransition,
  isTerminal,
} from './job-status';

describe('job status machine', () => {
  it('allows pending → running and pending → failed', () => {
    expect(canTransition(JobStatus.PENDING, JobStatus.RUNNING)).toBe(true);
    expect(canTransition(JobStatus.PENDING, JobStatus.FAILED)).toBe(true);
    expect(allowedTransitions(JobStatus.PENDING)).toEqual([
      JobStatus.RUNNING,
      JobStatus.FAILED,
    ]);
  });

  it('allows running → completed and running → failed', () => {
    expect(canTransition(JobStatus.RUNNING, JobStatus.COMPLETED)).toBe(true);
    expect(canTransition(JobStatus.RUNNING, JobStatus.FAILED)).toBe(true);
  });

  it('rejects skips, no-ops, and reverse transitions', () => {
    expect(canTransition(JobStatus.PENDING, JobStatus.COMPLETED)).toBe(false);
    expect(canTransition(JobStatus.PENDING, JobStatus.PENDING)).toBe(false);
    expect(canTransition(JobStatus.RUNNING, JobStatus.PENDING)).toBe(false);
    expect(canTransition(JobStatus.COMPLETED, JobStatus.RUNNING)).toBe(false);
    expect(canTransition(JobStatus.FAILED, JobStatus.RUNNING)).toBe(false);
    expect(canTransition(JobStatus.FAILED, JobStatus.PENDING)).toBe(false);
    expect(canTransition(JobStatus.COMPLETED, JobStatus.FAILED)).toBe(false);
  });

  it('treats completed and failed as terminal', () => {
    expect(isTerminal(JobStatus.COMPLETED)).toBe(true);
    expect(isTerminal(JobStatus.FAILED)).toBe(true);
    expect(isTerminal(JobStatus.PENDING)).toBe(false);
    expect(isTerminal(JobStatus.RUNNING)).toBe(false);
    expect(allowedTransitions(JobStatus.COMPLETED)).toEqual([]);
    expect(allowedTransitions(JobStatus.FAILED)).toEqual([]);
  });
});
