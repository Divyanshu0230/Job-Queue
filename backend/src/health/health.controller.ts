import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

@ApiTags('health')
@Controller()
export class RootController {
  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'API index' })
  index() {
    return {
      name: 'Job Queue API',
      status: 'ok',
      jobs: '/jobs',
      health: '/health',
      docs: '/docs',
    };
  }
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @SkipThrottle()
  @Get()
  @ApiOperation({ summary: 'Liveness and database check' })
  async check() {
    await this.dataSource.query('SELECT 1');
    return {
      status: 'ok',
      database: this.dataSource.options.type,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
