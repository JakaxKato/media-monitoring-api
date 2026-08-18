import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { MentionRepository } from '../../src/modules/mentions/mention.repository.js';
import { MentionService } from '../../src/modules/mentions/mention.service.js';

const input = [{
  external_id: 'str-99120',
  source: 'The Star',
  title: 'Ringgit strengthens',
  content: '<p>Improved sentiment.</p>',
  url: 'https://example.com/ringgit',
  author: 'Aisyah',
  published_at: '2026-08-10T08:15:00Z',
  engagement: 412
}];

describe('MentionService', () => {
  it('wraps bulk upserts in a transaction and reports duplicates', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (query: string) => {
        queries.push(query);
        return { rows: [], rowCount: 0 };
      }),
      release: vi.fn()
    } as unknown as PoolClient;
    const repository = {
      upsert: vi.fn()
        .mockResolvedValueOnce({ inserted: true, row: {} })
        .mockResolvedValueOnce({ inserted: false, row: {} })
    } as unknown as MentionRepository;
    const pool = { connect: vi.fn().mockResolvedValue(client) };
    const service = new MentionService(pool, repository);

    const result = await service.ingestBulk([input[0], input[0]]);

    expect(result).toEqual({ received: 2, inserted: 1, updated: 1, duplicates: 1 });
    expect(queries).toEqual(['BEGIN', 'COMMIT']);
    expect(client.release).toHaveBeenCalledOnce();
    expect(repository.upsert).toHaveBeenCalledTimes(2);
  });
});
