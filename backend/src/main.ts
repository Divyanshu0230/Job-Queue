import { createNestApp } from './create-app';

async function bootstrap() {
  const app = await createNestApp();
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Job Queue API ready on http://localhost:${port}`);
  console.log(`Swagger UI: http://localhost:${port}/docs`);
}

bootstrap();
