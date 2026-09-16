import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DataSource } from 'typeorm';

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
