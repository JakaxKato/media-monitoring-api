import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('mentions API validation', () => {
  it('rejects an invalid stats group', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/mentions/stats?group_by=invalid'
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' }
    });
    await app.close();
  });

  it('protects bulk ingestion when an API key is configured', async () => {
    const previousKey = process.env.INGEST_API_KEY;
    process.env.INGEST_API_KEY = 'test-key';
    const app = buildApp();

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/internal/mentions/bulk',
        payload: []
      });

      expect(response.statusCode).toBe(401);
      expect(response.json()).toMatchObject({
        error: { code: 'UNAUTHORIZED' }
      });
    } finally {
      if (previousKey === undefined) delete process.env.INGEST_API_KEY;
      else process.env.INGEST_API_KEY = previousKey;
      await app.close();
    }
  });
});
