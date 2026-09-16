import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JobConflictException } from '../common/exceptions/job-conflict.exception';
import { JobEvent } from './entities/job-event.entity';
import { Job } from './entities/job.entity';
import { JobPriority, JobStatus, JobType } from './job-status';
import { JobsService } from './jobs.service';

describe('JobsService.updateStatus concurrency', () => {
  const job: Job = {
    id: '11111111-1111-4111-8111-111111111111',
    title: 'Concurrent claim',
    type: JobType.EMAIL,
    status: JobStatus.PENDING,
    priority: JobPriority.NORMAL,
    notes: '',
    version: 1,
    startedAt: null,
    finishedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    events: [],
  };

  function createHarness(affected: number, latestStatus = JobStatus.RUNNING) {
    const jobs = {
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as unknown as Repository<Job>;
    const events = {} as Repository<JobEvent>;

    const manager = {
      findOne: jest.fn().mockResolvedValue({ ...job }),
      update: jest.fn().mockResolvedValue({ affected }),
      save: jest.fn(),
      create: jest.fn().mockImplementation((_cls: unknown, value: unknown) => value),
      findOneOrFail: jest.fn().mockResolvedValue({
        ...job,
        status: latestStatus,
        version: 2,
        events: [],
      }),
    };

    const dataSource = {
      options: { type: 'better-sqlite3' },
      query: jest.fn(),
      transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) =>
        fn(manager),
      ),
    } as unknown as DataSource;

    return { jobs, events, dataSource, manager };
  }

  it('rejects an illegal reverse transition before writing', async () => {
    const { jobs, events, dataSource, manager } = createHarness(1);
    manager.findOne.mockResolvedValue({
      ...job,
      status: JobStatus.COMPLETED,
      version: 3,
    });
    const service = new JobsService(jobs, events, dataSource);

    await expect(
      service.updateStatus(job.id, { status: JobStatus.RUNNING }),
    ).rejects.toBeInstanceOf(JobConflictException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('returns STALE_STATUS when the compare-and-swap write matches no row', async () => {
    const { jobs, events, dataSource, manager } = createHarness(0, JobStatus.RUNNING);
    manager.findOne
      .mockResolvedValueOnce({ ...job })
      .mockResolvedValueOnce({ ...job, status: JobStatus.RUNNING, version: 2 });
    const service = new JobsService(jobs, events, dataSource);

    await expect(
      service.updateStatus(job.id, { status: JobStatus.RUNNING }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'STALE_STATUS' }),
    });
  });

  it('rejects a stale expectedVersion', async () => {
    const { jobs, events, dataSource, manager } = createHarness(1);
    const service = new JobsService(jobs, events, dataSource);

    await expect(
      service.updateStatus(job.id, {
        status: JobStatus.RUNNING,
        expectedVersion: 99,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'VERSION_CONFLICT' }),
    });
    expect(manager.update).not.toHaveBeenCalled();
  });
});

describe('JobsService wiring', () => {
  it('can be constructed by Nest testing module', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: getRepositoryToken(Job), useValue: { count: jest.fn() } },
        { provide: getRepositoryToken(JobEvent), useValue: {} },
        {
          provide: DataSource,
          useValue: { options: { type: 'better-sqlite3' }, query: jest.fn(), transaction: jest.fn() },
        },
      ],
    }).compile();

    expect(moduleRef.get(JobsService)).toBeDefined();
  });
});
