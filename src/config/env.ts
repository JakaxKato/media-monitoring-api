import { z } from 'zod';

const nodeEnv = process.env.NODE_ENV ?? 'development';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  INGEST_API_KEY: z.string().min(1).optional()
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? (nodeEnv === 'production' ? undefined : 'postgres://mentions:mentions@localhost:5432/mentions'),
  PORT: process.env.PORT ?? 3000,
  HOST: process.env.HOST ?? '0.0.0.0',
  NODE_ENV: nodeEnv,
  INGEST_API_KEY: process.env.INGEST_API_KEY
});
