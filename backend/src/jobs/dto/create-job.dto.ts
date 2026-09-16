import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JobPriority, JobType } from '../job-status';

export class CreateJobDto {
  @ApiProperty({
    example: 'Send weekly retention report',
    minLength: 3,
    maxLength: 120,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title: string;

  @ApiProperty({ enum: JobType, example: JobType.REPORT })
  @IsEnum(JobType, {
    message: `type must be one of: ${Object.values(JobType).join(', ')}`,
  })
  type: JobType;

  @ApiPropertyOptional({ enum: JobPriority, default: JobPriority.NORMAL })
  @IsOptional()
  @IsEnum(JobPriority, {
    message: `priority must be one of: ${Object.values(JobPriority).join(', ')}`,
  })
  priority?: JobPriority;

  @ApiPropertyOptional({ maxLength: 400 })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(400)
  notes?: string;
}
