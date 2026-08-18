import type { Pool, PoolClient } from 'pg';
import { AppError } from '../../shared/errors.js';
import { normalizeMention } from './mention.normalizer.js';
import { MentionRepository } from './mention.repository.js';
import { bulkMentionInputSchema } from './mention.validation.js';
import type { QueryClient, SearchParams, SearchResult, StatRow } from './mention.types.js';

export type BulkResult = {
  received: number;
  inserted: number;
  updated: number;
  duplicates: number;
};

export class MentionService {
  constructor(
    private readonly pool: Pick<Pool, 'connect'>,
    private readonly repository: MentionRepository
  ) {}

  async ingestBulk(payload: unknown): Promise<BulkResult> {
    const parsed = bulkMentionInputSchema.safeParse(payload);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Bulk payload must be an array of valid mention records', parsed.error.issues);
    }

    const client = await this.pool.connect();
    const result: BulkResult = { received: parsed.data.length, inserted: 0, updated: 0, duplicates: 0 };

    try {
      await client.query('BEGIN');
      for (const input of parsed.data) {
        const mention = normalizeMention(input);
        const upserted = await this.repository.upsert(client, mention);
        if (upserted.inserted) {
          result.inserted += 1;
        } else {
          result.updated += 1;
          result.duplicates += 1;
        }
      }
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async search(client: QueryClient, params: SearchParams): Promise<SearchResult> {
    return this.repository.search(client, params);
  }

  async statsBySource(client: QueryClient): Promise<StatRow[]> {
    return this.repository.statsBySource(client);
  }

  async statsByDay(client: QueryClient): Promise<StatRow[]> {
    return this.repository.statsByDay(client);
  }
}
