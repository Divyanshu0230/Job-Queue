import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { JobStatus, JobType } from '../src/jobs/job-status';

describe('Jobs API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.TYPEORM_LOGGING = 'false';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / returns an API index instead of 404', async () => {
    const res = await request(app.getHttpServer()).get('/').expect(200);
    expect(res.body).toMatchObject({
      name: 'Job Queue API',
      status: 'ok',
      jobs: '/jobs',
      health: '/health',
    });
  });

  it('GET /health reports a live database', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('POST /jobs validates title and type', async () => {
    await request(app.getHttpServer())
      .post('/jobs')
      .send({ title: 'ab', type: JobType.EMAIL })
      .expect(400);

    await request(app.getHttpServer())
      .post('/jobs')
      .send({ title: 'Valid job title', type: 'not-a-type' })
      .expect(400);
  });

  it('creates, lists, filters, and deletes a job', async () => {
    const created = await request(app.getHttpServer())
      .post('/jobs')
      .send({ title: 'Generate invoice PDF', type: JobType.REPORT })
      .expect(201);

    expect(created.body.status).toBe(JobStatus.PENDING);
    expect(created.body.version).toBe(1);

    const listed = await request(app.getHttpServer())
      .get('/jobs')
      .query({ search: 'invoice' })
      .expect(200);

    expect(listed.body.data.some((job: { id: string }) => job.id === created.body.id)).toBe(
      true,
    );
    expect(listed.body.stats.all).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .delete(`/jobs/${created.body.id}`)
      .expect(204);

    await request(app.getHttpServer()).get(`/jobs/${created.body.id}`).expect(404);
  });

  it('enforces the status machine and refuses reverse transitions', async () => {
    const created = await request(app.getHttpServer())
      .post('/jobs')
      .send({ title: 'Lifecycle probe', type: JobType.CLEANUP })
      .expect(201);

    const id = created.body.id as string;

    await request(app.getHttpServer())
      .patch(`/jobs/${id}/status`)
      .send({ status: JobStatus.COMPLETED })
      .expect(409);

    await request(app.getHttpServer())
      .patch(`/jobs/${id}/status`)
      .send({ status: JobStatus.RUNNING, expectedVersion: 1 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/jobs/${id}/status`)
      .send({ status: JobStatus.COMPLETED })
      .expect(200);

    const reverse = await request(app.getHttpServer())
      .patch(`/jobs/${id}/status`)
      .send({ status: JobStatus.RUNNING })
      .expect(409);

    expect(reverse.body.code).toBe('INVALID_TRANSITION');
    expect(reverse.body.currentStatus).toBe(JobStatus.COMPLETED);
    expect(reverse.body.allowedTransitions).toEqual([]);
  });

  it('lets only one of two concurrent pending → running writes win', async () => {
    const created = await request(app.getHttpServer())
      .post('/jobs')
      .send({ title: 'Two tab race', type: JobType.WEBHOOK })
      .expect(201);

    const id = created.body.id as string;
    const server = app.getHttpServer();

    const [first, second] = await Promise.all([
      request(server).patch(`/jobs/${id}/status`).send({ status: JobStatus.RUNNING }),
      request(server).patch(`/jobs/${id}/status`).send({ status: JobStatus.RUNNING }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = first.status === 200 ? first : second;
    const loser = first.status === 409 ? first : second;

    expect(winner.body.status).toBe(JobStatus.RUNNING);
    expect(winner.body.version).toBe(2);
    expect(loser.body.code).toMatch(/STALE_STATUS|VERSION_CONFLICT|INVALID_TRANSITION/);

    const latest = await request(server).get(`/jobs/${id}`).expect(200);
    expect(latest.body.status).toBe(JobStatus.RUNNING);
    expect(latest.body.events).toHaveLength(1);
  });
});
