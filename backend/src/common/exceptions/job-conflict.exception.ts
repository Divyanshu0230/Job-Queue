import { ConflictException } from '@nestjs/common';
import { JobStatus } from '../../jobs/job-status';

export type JobConflictCode =
  | 'INVALID_TRANSITION'
  | 'VERSION_CONFLICT'
  | 'STALE_STATUS';

export class JobConflictException extends ConflictException {
  constructor(payload: {
    code: JobConflictCode;
    message: string;
    currentStatus: JobStatus;
    requestedStatus: JobStatus;
    allowedTransitions: JobStatus[];
    currentVersion?: number;
  }) {
    super({
      statusCode: 409,
      error: 'Conflict',
      ...payload,
    });
  }
}
