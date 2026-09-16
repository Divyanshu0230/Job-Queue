import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { RequestIdInterceptor } from './common/interceptors/request-id.interceptor';
import { buildDatabaseConfig } from './database/database.config';
import { HealthController, RootController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => buildDatabaseConfig(),
    }),
    ThrottlerModule.forRoot({
      skipIf: (context) => {
        const request = context.switchToHttp().getRequest<{ url?: string }>();
        return Boolean(request.url?.startsWith('/jobs/stream'));
      },
      throttlers: [
        {
          ttl: 60_000,
          limit: 120,
        },
      ],
    }),
    JobsModule,
  ],
  controllers: [RootController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
  ],
})
export class AppModule {}
