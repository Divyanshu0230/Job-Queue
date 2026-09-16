import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { JobStatus } from '../job-status';

export class UpdateJobStatusDto {
  @ApiProperty({ enum: JobStatus, example: JobStatus.RUNNING })
  @IsEnum(JobStatus, {
    message: `status must be one of: ${Object.values(JobStatus).join(', ')}`,
  })
  status: JobStatus;

  @ApiPropertyOptional({
    description:
      'Optimistic lock token from GET /jobs. If provided, the write is rejected when another request already mutated the row.',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  expectedVersion?: number;
}
