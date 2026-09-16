import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';

export async function createNestApp(
  expressApp?: Express,
): Promise<INestApplication> {
  const app = expressApp
    ? await NestFactory.create(AppModule, new ExpressAdapter(expressApp))
    : await NestFactory.create(AppModule);

  const origins = process.env.FRONTEND_ORIGIN
    ? process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim())
    : true;

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({ origin: origins });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Job Queue API')
    .setDescription(
      'Job queue API. Status transitions are enforced atomically on the server with compare-and-swap writes. Illegal or racing updates return 409 Conflict.',
    )
    .setVersion('1.0.0')
    .addTag('jobs')
    .addTag('health')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, swagger));

  return app;
}
