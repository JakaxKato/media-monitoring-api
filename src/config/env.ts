import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default('0.0.0.0')
});

export const env = envSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://mentions:mentions@localhost:5432/mentions',
  PORT: process.env.PORT ?? 3000,
  HOST: process.env.HOST ?? '0.0.0.0'
});
