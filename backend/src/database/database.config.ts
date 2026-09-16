import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { JobEvent } from '../jobs/entities/job-event.entity';
import { Job } from '../jobs/entities/job.entity';

export function buildDatabaseConfig(): TypeOrmModuleOptions {
  const url = process.env.DATABASE_URL;
  const isPostgres = Boolean(url?.startsWith('postgres'));
  const sync = process.env.TYPEORM_SYNC !== 'false';

  if (isPostgres && url) {
    const useSsl =
      process.env.DATABASE_SSL === 'true' ||
      url.includes('sslmode=require') ||
      process.env.NODE_ENV === 'production';

    return {
      type: 'postgres',
      url,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
      entities: [Job, JobEvent],
      synchronize: sync,
      logging: process.env.TYPEORM_LOGGING === 'true',
    };
  }

  const database = process.env.DATABASE_PATH ?? join(process.cwd(), 'data', 'queue.sqlite');
  if (database !== ':memory:') {
    mkdirSync(dirname(database), { recursive: true });
  }

  return {
    type: 'better-sqlite3',
    database,
    entities: [Job, JobEvent],
    synchronize: true,
    logging: process.env.TYPEORM_LOGGING === 'true',
  };
}
