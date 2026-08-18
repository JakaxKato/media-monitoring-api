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
});
