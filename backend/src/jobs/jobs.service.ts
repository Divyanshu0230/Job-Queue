import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Subject } from 'rxjs';
import { DataSource, Repository } from 'typeorm';
import { JobConflictException } from '../common/exceptions/job-conflict.exception';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { JobEvent } from './entities/job-event.entity';
import { Job } from './entities/job.entity';
import {
  JobPriority,
  JobStatus,
  JobType,
  allowedTransitions,
  canTransition,
} from './job-status';

export type JobChangeEvent =
  | { type: 'created' | 'updated'; job: Job }
  | { type: 'deleted'; id: string };

export interface JobStats {
  all: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
}

export interface PaginatedJobs {
  data: Job[];
  meta: {
    page: number;
    limit: number;
    total: number;
    pageCount: number;
  };
  stats: JobStats;
}

export interface ActivityItem {
  id: string;
  jobId: string;
  jobTitle: string;
  jobType: JobType;
  fromStatus: JobStatus;
  toStatus: JobStatus;
  createdAt: Date;
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

const WAITING_MS = 15 * 60 * 1000;

const SEED_JOBS: Array<{
  title: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  notes: string;
}> = [
  {
    title: 'Send password reset email',
    type: JobType.EMAIL,
    status: JobStatus.COMPLETED,
    priority: JobPriority.HIGH,
    notes: 'Customer asked from the login screen.',
  },
  {
    title: 'Weekly funnel report',
    type: JobType.REPORT,
    status: JobStatus.RUNNING,
    priority: JobPriority.NORMAL,
    notes: 'Goes to the growth team every Monday.',
  },
  {
    title: 'Bring in yesterday’s payments',
    type: JobType.INGEST,
    status: JobStatus.PENDING,
    priority: JobPriority.HIGH,
    notes: 'Waiting on the overnight file.',
  },
  {
    title: 'Notify ops of failed payments',
    type: JobType.WEBHOOK,
    status: JobStatus.FAILED,
    priority: JobPriority.URGENT,
    notes: 'Partner returned 500. Queue again after they recover.',
  },
  {
    title: 'Clear expired sessions',
    type: JobType.CLEANUP,
    status: JobStatus.PENDING,
    priority: JobPriority.LOW,
    notes: 'Safe to run any time after hours.',
  },
  {
    title: 'Welcome sequence for new captains',
    type: JobType.EMAIL,
    status: JobStatus.PENDING,
    priority: JobPriority.NORMAL,
    notes: 'Three emails over seven days.',
  },
  {
    title: 'Daily sales snapshot',
    type: JobType.REPORT,
    status: JobStatus.COMPLETED,
    priority: JobPriority.NORMAL,
    notes: '',
  },
  {
    title: 'Retry missed partner callbacks',
    type: JobType.WEBHOOK,
    status: JobStatus.RUNNING,
    priority: JobPriority.HIGH,
    notes: 'Only the last 24 hours.',
  },
  {
    title: 'Clear old export files',
    type: JobType.CLEANUP,
    status: JobStatus.COMPLETED,
    priority: JobPriority.LOW,
    notes: 'Keep the last 30 days.',
  },
  {
    title: 'Import partner spreadsheet',
    type: JobType.INGEST,
    status: JobStatus.FAILED,
    priority: JobPriority.HIGH,
    notes: 'Row 18 has a blank store id.',
  },
  {
    title: 'Late-job digest',
    type: JobType.EMAIL,
    status: JobStatus.PENDING,
    priority: JobPriority.URGENT,
    notes: 'Send if anything is still waiting after 15 minutes.',
  },
  {
    title: 'Rebuild search index',
    type: JobType.INGEST,
    status: JobStatus.PENDING,
    priority: JobPriority.NORMAL,
    notes: 'Run after the import finishes.',
  },
];

@Injectable()
export class JobsService implements OnModuleInit {
  private readonly logger = new Logger(JobsService.name);
  private readonly changes = new Subject<JobChangeEvent>();

  constructor(
    @InjectRepository(Job)
    private readonly jobs: Repository<Job>,
    @InjectRepository(JobEvent)
    private readonly events: Repository<JobEvent>,
    private readonly dataSource: DataSource,
  ) {}

  stream() {
    return this.changes.asObservable();
  }

  async onModuleInit(): Promise<void> {
    if (this.dataSource.options.type === 'better-sqlite3') {
      await this.dataSource.query('PRAGMA foreign_keys = ON');
      await this.dataSource.query('PRAGMA journal_mode = WAL');
    }

    const count = await this.jobs.count();
    if (count === 0) {
      await this.seed();
    }
  }

  async create(dto: CreateJobDto): Promise<Job> {
    const job = this.jobs.create({
      title: dto.title,
      type: dto.type,
      priority: dto.priority ?? JobPriority.NORMAL,
      notes: dto.notes ?? '',
      status: JobStatus.PENDING,
      version: 1,
      startedAt: null,
      finishedAt: null,
    });
    const saved = await this.jobs.save(job);
    this.publish({ type: 'created', job: saved });
    return saved;
  }

  async findAll(query: QueryJobsDto): Promise<PaginatedJobs> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const qb = this.jobs.createQueryBuilder('job');

    if (query.attention) {
      const cutoff = new Date(Date.now() - WAITING_MS);
      qb.andWhere(
        '(job.status = :failed OR (job.status = :pending AND job.createdAt <= :cutoff))',
        {
          failed: JobStatus.FAILED,
          pending: JobStatus.PENDING,
          cutoff,
        },
      );
    } else if (query.status) {
      qb.andWhere('job.status = :status', { status: query.status });
    }
    if (query.type) {
      qb.andWhere('job.type = :type', { type: query.type });
    }
    if (query.priority) {
      qb.andWhere('job.priority = :priority', { priority: query.priority });
    }
    if (query.search?.trim()) {
      const search = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(job.title) LIKE :search OR LOWER(job.id) LIKE :search OR LOWER(job.notes) LIKE :search)',
        { search },
      );
    }

    if (query.sort === 'oldest') {
      qb.orderBy('job.createdAt', 'ASC');
    } else if (query.sort === 'priority') {
      qb.orderBy(
        `CASE job.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END`,
        'ASC',
      ).addOrderBy('job.createdAt', 'DESC');
    } else {
      qb.orderBy('job.createdAt', 'DESC');
    }
    qb.addOrderBy('job.id', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();
        const stats = await this.getStats();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        pageCount: Math.max(1, Math.ceil(total / limit)),
      },
      stats,
    };
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.jobs.findOne({
      where: { id },
      relations: ['events'],
    });
    if (!job) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: `Job ${id} was not found`,
      });
    }
    job.events = [...(job.events ?? [])].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    return job;
  }

  /**
   * Compare-and-swap status update.
   *
   * 1. Read the current row inside a transaction.
   * 2. Reject illegal transitions in application code (clear 409 payload).
   * 3. Persist with UPDATE ... WHERE id AND status AND version.
   *    If another request already committed, affected = 0 and we 409.
   *
   * The WHERE clause is the source of truth. The React UI cannot bypass it,
   * and two concurrent "pending → running" writes cannot both succeed.
   */
  async updateStatus(id: string, dto: UpdateJobStatusDto): Promise<Job> {
    const nextStatus = dto.status;

    const updated = await this.dataSource.transaction(async (manager) => {
      const job = await manager.findOne(Job, { where: { id } });
      if (!job) {
        throw new NotFoundException({
          code: 'JOB_NOT_FOUND',
          message: `Job ${id} was not found`,
        });
      }

      if (
        dto.expectedVersion !== undefined &&
        dto.expectedVersion !== job.version
      ) {
        throw new JobConflictException({
          code: 'VERSION_CONFLICT',
          message:
            'This job changed in another session. Refresh and try again.',
          currentStatus: job.status,
          requestedStatus: nextStatus,
          allowedTransitions: allowedTransitions(job.status),
          currentVersion: job.version,
        });
      }

      if (!canTransition(job.status, nextStatus)) {
        throw new JobConflictException({
          code: 'INVALID_TRANSITION',
          message: `A ${job.status} job cannot move to ${nextStatus}.`,
          currentStatus: job.status,
          requestedStatus: nextStatus,
          allowedTransitions: allowedTransitions(job.status),
          currentVersion: job.version,
        });
      }

      const fromStatus = job.status;
      const patch: Partial<Job> = {
        status: nextStatus,
        version: job.version + 1,
      };
      if (nextStatus === JobStatus.RUNNING) {
        patch.startedAt = new Date();
      }
      if (
        nextStatus === JobStatus.COMPLETED ||
        nextStatus === JobStatus.FAILED
      ) {
        patch.finishedAt = new Date();
      }

      const result = await manager.update(
        Job,
        { id: job.id, status: fromStatus, version: job.version },
        patch,
      );

      if (result.affected !== 1) {
        const latest = await manager.findOne(Job, { where: { id } });
        throw new JobConflictException({
          code: 'STALE_STATUS',
          message: 'Someone else updated this job first. Refresh and try again.',
          currentStatus: latest?.status ?? fromStatus,
          requestedStatus: nextStatus,
          allowedTransitions: allowedTransitions(
            latest?.status ?? fromStatus,
          ),
          currentVersion: latest?.version,
        });
      }

      await manager.save(
        manager.create(JobEvent, {
          jobId: job.id,
          fromStatus,
          toStatus: nextStatus,
        }),
      );

      return manager.findOneOrFail(Job, {
        where: { id },
        relations: ['events'],
      });
    });

    this.logger.log(
      `job ${id} ${updated.status} (v${updated.version}) via CAS`,
    );
    this.publish({ type: 'updated', job: updated });
    return updated;
  }

  async remove(id: string): Promise<void> {
    const result = await this.jobs.delete(id);
    if (!result.affected) {
      throw new NotFoundException({
        code: 'JOB_NOT_FOUND',
        message: `Job ${id} was not found`,
      });
    }
    this.publish({ type: 'deleted', id });
  }

  async clone(id: string): Promise<Job> {
    const source = await this.findOne(id);
    return this.create({
      title: source.title,
      type: source.type,
      priority: source.priority,
      notes: source.notes,
    });
  }

  async updateDetails(id: string, dto: UpdateJobDto): Promise<Job> {
    const job = await this.findOne(id);
    if (dto.title !== undefined) job.title = dto.title;
    if (dto.priority !== undefined) job.priority = dto.priority;
    if (dto.notes !== undefined) job.notes = dto.notes;
    const saved = await this.jobs.save(job);
    this.publish({ type: 'updated', job: saved });
    return saved;
  }

  async bulkStart(ids: string[]): Promise<{ started: number; skipped: number }> {
    let started = 0;
    let skipped = 0;
    for (const id of [...new Set(ids)]) {
      try {
        const job = await this.findOne(id);
        if (job.status !== JobStatus.PENDING) {
          skipped += 1;
          continue;
        }
        await this.updateStatus(id, {
          status: JobStatus.RUNNING,
          expectedVersion: job.version,
        });
        started += 1;
      } catch {
        skipped += 1;
      }
    }
    return { started, skipped };
  }

  async getActivity(limit = 40): Promise<ActivityItem[]> {
    const rows = await this.events
      .createQueryBuilder('event')
      .innerJoinAndSelect('event.job', 'job')
      .orderBy('event.createdAt', 'DESC')
      .take(Math.min(Math.max(limit, 1), 100))
      .getMany();

    return rows.map((event) => ({
      id: event.id,
      jobId: event.jobId,
      jobTitle: event.job.title,
      jobType: event.job.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      createdAt: event.createdAt,
    }));
  }

  async getOverview(): Promise<Overview> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const cutoff = new Date(Date.now() - WAITING_MS);
    const [stats, typeRows, createdToday, finishedToday, failedToday, timed, recentJobs, activity, failedJobs, waitingJobs] =
      await Promise.all([
        this.getStats(),
        this.jobs
          .createQueryBuilder('job')
          .select('job.type', 'type')
          .addSelect('COUNT(job.id)', 'count')
          .groupBy('job.type')
          .getRawMany<{ type: JobType; count: string | number }>(),
        this.jobs
          .createQueryBuilder('job')
          .where('job.createdAt >= :startOfDay', { startOfDay })
          .getCount(),
        this.jobs
          .createQueryBuilder('job')
          .where('job.status = :status', { status: JobStatus.COMPLETED })
          .andWhere('job.finishedAt >= :startOfDay', { startOfDay })
          .getCount(),
        this.jobs
          .createQueryBuilder('job')
          .where('job.status = :status', { status: JobStatus.FAILED })
          .andWhere('job.finishedAt >= :startOfDay', { startOfDay })
          .getCount(),
        this.jobs.find({
          where: { status: JobStatus.COMPLETED },
        }),
        this.jobs.find({
          order: { createdAt: 'DESC' },
          take: 6,
        }),
        this.getActivity(8),
        this.jobs.find({
          where: { status: JobStatus.FAILED },
          order: { finishedAt: 'DESC' },
          take: 5,
        }),
        this.jobs
          .createQueryBuilder('job')
          .where('job.status = :pending', { pending: JobStatus.PENDING })
          .andWhere('job.createdAt <= :cutoff', { cutoff })
          .orderBy('job.createdAt', 'ASC')
          .take(5)
          .getMany(),
      ]);

    const typeBreakdown: Record<JobType, number> = {
      [JobType.EMAIL]: 0,
      [JobType.REPORT]: 0,
      [JobType.INGEST]: 0,
      [JobType.WEBHOOK]: 0,
      [JobType.CLEANUP]: 0,
    };
    for (const row of typeRows) {
      typeBreakdown[row.type] = Number(row.count);
    }

    const durations = timed
      .filter((job) => job.startedAt && job.finishedAt)
      .map(
        (job) =>
          (new Date(job.finishedAt as Date).getTime() -
            new Date(job.startedAt as Date).getTime()) /
          1000,
      );
    const avgDurationSeconds =
      durations.length > 0
        ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
        : null;

    const decided = stats.completed + stats.failed;
    const successRate =
      decided > 0 ? Math.round((stats.completed / decided) * 100) : null;

    const waitingCount = await this.jobs
      .createQueryBuilder('job')
      .where('job.status = :pending', { pending: JobStatus.PENDING })
      .andWhere('job.createdAt <= :cutoff', { cutoff })
      .getCount();

    return {
      stats,
      typeBreakdown,
      createdToday,
      finishedToday,
      failedToday,
      avgDurationSeconds,
      successRate,
      attentionCount: stats.failed + waitingCount,
      failedJobs,
      waitingJobs,
      recentJobs,
      activity,
    };
  }

  async getStats(search?: string, type?: JobType): Promise<JobStats> {
    const qb = this.jobs
      .createQueryBuilder('job')
      .select('job.status', 'status')
      .addSelect('COUNT(job.id)', 'count');

    if (type) {
      qb.andWhere('job.type = :type', { type });
    }
    if (search?.trim()) {
      const term = `%${search.trim().toLowerCase()}%`;
      qb.andWhere(
        '(LOWER(job.title) LIKE :search OR LOWER(job.id) LIKE :search)',
        { search: term },
      );
    }

    const rows = await qb.groupBy('job.status').getRawMany<{
      status: JobStatus;
      count: string | number;
    }>();

    const stats: JobStats = {
      all: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
    };

    for (const row of rows) {
      const count = Number(row.count);
      stats[row.status] = count;
      stats.all += count;
    }

    return stats;
  }

  private publish(event: JobChangeEvent) {
    this.changes.next(event);
  }

  private async seed(): Promise<void> {
    this.logger.log('Seeding demo jobs');
    for (const [index, item] of SEED_JOBS.entries()) {
      const createdAt = new Date(Date.now() - (SEED_JOBS.length - index) * 36 * 60 * 1000);
      const job = await this.jobs.save(
        this.jobs.create({
          ...item,
          version: item.status === JobStatus.PENDING ? 1 : item.status === JobStatus.RUNNING ? 2 : 3,
          startedAt:
            item.status === JobStatus.PENDING ? null : new Date(createdAt.getTime() + 8 * 60 * 1000),
          finishedAt:
            item.status === JobStatus.COMPLETED || item.status === JobStatus.FAILED
              ? new Date(createdAt.getTime() + 21 * 60 * 1000)
              : null,
          createdAt,
        }),
      );

      const history: Array<[JobStatus, JobStatus]> = [];
      if (item.status === JobStatus.RUNNING) {
        history.push([JobStatus.PENDING, JobStatus.RUNNING]);
      } else if (item.status === JobStatus.COMPLETED) {
        history.push(
          [JobStatus.PENDING, JobStatus.RUNNING],
          [JobStatus.RUNNING, JobStatus.COMPLETED],
        );
      } else if (item.status === JobStatus.FAILED) {
        history.push(
          [JobStatus.PENDING, JobStatus.RUNNING],
          [JobStatus.RUNNING, JobStatus.FAILED],
        );
      }

      for (const [fromStatus, toStatus] of history) {
        await this.events.save(
          this.events.create({ jobId: job.id, fromStatus, toStatus }),
        );
      }
    }
  }
}
