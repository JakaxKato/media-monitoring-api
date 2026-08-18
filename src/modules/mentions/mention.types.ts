import type { PoolClient } from 'pg';

export type MentionInput = {
  external_id: string;
  source: string;
  title: string | null;
  content: string;
  url: string | null;
  author: string | null;
  published_at: string | number | null;
  engagement: string | number;
};

export type NormalizedMention = {
  dedupeKey: string;
  externalId: string;
  source: string;
  sourceRaw: string;
  title: string | null;
  contentRaw: string;
  contentText: string;
  url: string | null;
  urlCanonical: string | null;
  author: string | null;
  publishedAt: Date | null;
  engagement: number;
};

export type MentionRow = NormalizedMention & {
  id: string;
  createdAt: Date;
  updatedAt: Date;
};

export type QueryClient = Pick<PoolClient, 'query'>;

export type SearchParams = {
  q?: string;
  source?: string;
  from?: Date;
  to?: Date;
  page: number;
  limit: number;
};

export type SearchResult = {
  rows: MentionRow[];
  total: number;
};

export type StatsGroup = 'source' | 'day';

export type StatRow = {
  group: string;
  count: number;
};
