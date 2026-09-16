import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JobStatus } from '../job-status';
import { Job } from './job.entity';

@Entity({ name: 'job_events' })
@Index(['jobId', 'createdAt'])
export class JobEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36 })
  jobId: string;

  @ManyToOne(() => Job, (job) => job.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'jobId' })
  job: Job;

  @Column({ type: 'varchar', length: 32 })
  fromStatus: JobStatus;

  @Column({ type: 'varchar', length: 32 })
  toStatus: JobStatus;

  @CreateDateColumn()
  createdAt: Date;
}
