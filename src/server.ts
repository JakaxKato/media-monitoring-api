import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { buildApp } from './app.js';

const app = buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  await pool.end();
}

process.once('SIGTERM', () => shutdown('SIGTERM').catch((error) => {
  app.log.error(error);
  process.exit(1);
}));
process.once('SIGINT', () => shutdown('SIGINT').catch((error) => {
  app.log.error(error);
  process.exit(1);
}));

app.listen({ port: env.PORT, host: env.HOST }).catch((error) => {
  app.log.error(error);
  process.exit(1);
});
