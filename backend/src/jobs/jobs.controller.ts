import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  MessageEvent,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { map, merge, Observable, interval } from 'rxjs';
import { BulkStartDto } from './dto/bulk-start.dto';
import { CreateJobDto } from './dto/create-job.dto';
import { QueryJobsDto } from './dto/query-jobs.dto';
import { UpdateJobDto } from './dto/update-job.dto';
import { UpdateJobStatusDto } from './dto/update-job-status.dto';
import { Job } from './entities/job.entity';
import { JobsService } from './jobs.service';

@ApiTags('jobs')
@Controller('jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a pending job' })
  create(@Body() dto: CreateJobDto): Promise<Job> {
    return this.jobs.create(dto);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'List jobs with filters, pagination, and status counts' })
  findAll(@Query() query: QueryJobsDto) {
    return this.jobs.findAll(query);
  }

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Dashboard snapshot: counts, mix, and recent work' })
  overview() {
    return this.jobs.getOverview();
  }

  @Get('activity')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Recent job status changes' })
  activity() {
    return this.jobs.getActivity();
  }

  @Post('bulk-start')
  @ApiOperation({ summary: 'Start several waiting jobs' })
  bulkStart(@Body() dto: BulkStartDto) {
    return this.jobs.bulkStart(dto.ids);
  }

  @SkipThrottle()
  @Sse('stream')
  @ApiOperation({
    summary: 'Server-sent events for live job changes (multi-tab sync)',
  })
  stream(): Observable<MessageEvent> {
    const updates = this.jobs.stream().pipe(
      map(
        (data) =>
          ({
            data,
            type: 'job',
          }) as MessageEvent,
      ),
    );
    const heartbeat = interval(15000).pipe(
      map(() => ({ data: { type: 'ping' }, type: 'ping' }) as MessageEvent),
    );
    return merge(updates, heartbeat);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a job and its status history' })
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.jobs.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Move a job to the next status' })
  updateStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateJobStatusDto,
  ) {
    return this.jobs.updateStatus(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update title, notes, or priority' })
  updateDetails(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdateJobDto,
  ) {
    return this.jobs.updateDetails(id, dto);
  }

  @Post(':id/clone')
  @ApiOperation({ summary: 'Queue a new pending copy of an existing job' })
  clone(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    return this.jobs.clone(id);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a job' })
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    await this.jobs.remove(id);
  }
}
