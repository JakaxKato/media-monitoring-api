import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import { join } from 'node:path';
import { pool } from './db/pool.js';
import { mentionRoutes } from './modules/mentions/mention.routes.js';
import { errorHandler } from './shared/errors.js';

export function buildApp() {
  const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });
  app.setErrorHandler(errorHandler);

  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/ready', async (_request, reply) => {
    await pool.query('SELECT 1');
    return reply.send({ status: 'ready' });
  });

  app.register(fastifyStatic, {
    root: join(process.cwd(), 'public'),
    index: 'index.html'
  });
  app.register(mentionRoutes);
  return app;
}
