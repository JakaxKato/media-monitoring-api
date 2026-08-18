import Fastify from 'fastify';
import { errorHandler } from './shared/errors.js';
import { mentionRoutes } from './modules/mentions/mention.routes.js';

export function buildApp() {
  const app = Fastify({ logger: true });
  app.setErrorHandler(errorHandler);
  app.register(mentionRoutes);
  return app;
}
