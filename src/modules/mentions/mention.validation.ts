import { z } from 'zod';
import type { StatsGroup } from './mention.types.js';

const mentionInputSchema = z.object({
  external_id: z.string().trim().min(1).max(200),
  source: z.string().min(1).max(200),
  title: z.string().max(500).nullable(),
  content: z.string().max(100_000),
  url: z.string().max(2_000).nullable(),
  author: z.string().max(300).nullable(),
  published_at: z.union([z.string(), z.number(), z.null()]),
  engagement: z.union([z.string(), z.number()])
});

export const bulkMentionInputSchema = z.array(mentionInputSchema).max(1_000);

const dateQuery = z.string().trim().min(1);

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).optional(),
  source: z.string().trim().min(1).optional(),
  from: dateQuery.optional(),
  to: dateQuery.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
});

export const statsQuerySchema = z.object({
  group_by: z.enum(['source', 'day'])
});

export function parseStatsGroup(value: unknown): StatsGroup {
  return statsQuerySchema.parse({ group_by: value }).group_by;
}
