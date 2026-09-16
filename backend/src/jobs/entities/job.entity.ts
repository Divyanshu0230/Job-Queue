import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JobPriority, JobStatus, JobType } from '../job-status';
import { JobEvent } from './job-event.entity';

@Entity({ name: 'jobs' })
@Index(['status'])
@Index(['type'])
@Index(['createdAt'])
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'varchar', length: 32 })
  type: JobType;

  @Column({ type: 'varchar', length: 32, default: JobStatus.PENDING })
  status: JobStatus;

  @Column({ type: 'varchar', length: 16, default: JobPriority.NORMAL })
  priority: JobPriority;

  @Column({ type: 'varchar', length: 400, default: '' })
  notes: string;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ type: process.env.DATABASE_URL?.startsWith('postgres') ? 'timestamptz' : 'datetime', nullable: true })
  startedAt: Date | null;

  @Column({ type: process.env.DATABASE_URL?.startsWith('postgres') ? 'timestamptz' : 'datetime', nullable: true })
  finishedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => JobEvent, (event) => event.job, { cascade: true })
  events: JobEvent[];
}
