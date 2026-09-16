import express from 'express';
import { createNestApp } from '../src/create-app';

const server = express();
let ready: Promise<void> | null = null;

async function bootstrap() {
  const app = await createNestApp(server);
  await app.init();
}

export default async function handler(
  req: express.Request,
  res: express.Response,
) {
  if (!ready) {
    ready = bootstrap();
  }
  await ready;
  server(req, res);
}
