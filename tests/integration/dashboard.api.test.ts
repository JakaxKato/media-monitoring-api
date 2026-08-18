import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';

describe('dashboard and health routes', () => {
  it('serves the read-only dashboard', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.body).toContain('Media monitoring');
    await app.close();
  });

  it('reports liveness without requiring database access', async () => {
    const app = buildApp();
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
