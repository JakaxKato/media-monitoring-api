import type { FastifyInstance } from 'fastify';
import { pool } from '../../db/pool.js';
import { AppError } from '../../shared/errors.js';
import { parsePublishedAt, normalizeSource } from './mention.normalizer.js';
import { MentionRepository } from './mention.repository.js';
import { MentionService } from './mention.service.js';
import { parseStatsGroup, searchQuerySchema } from './mention.validation.js';

function serializeMention(mention: Awaited<ReturnType<MentionRepository['search']>>['rows'][number]) {
  return {
    id: mention.id,
    external_id: mention.externalId,
    source: mention.source,
    title: mention.title,
    content: mention.contentText,
    url: mention.url,
    author: mention.author,
    published_at: mention.publishedAt,
    engagement: mention.engagement
  };
}

export async function mentionRoutes(app: FastifyInstance) {
  const repository = new MentionRepository();
  const service = new MentionService(pool, repository);

  app.post('/internal/mentions/bulk', async (request, reply) => {
    const expectedApiKey = process.env.INGEST_API_KEY;
    if (expectedApiKey !== undefined && request.headers['x-api-key'] !== expectedApiKey) {
      throw new AppError(401, 'UNAUTHORIZED', 'A valid ingestion API key is required');
    }

    const result = await service.ingestBulk(request.body);
    return reply.status(200).send({ data: result });
  });

  app.get('/mentions', async (request, reply) => {
    const query = searchQuerySchema.parse(request.query);
    const from = query.from === undefined ? undefined : parsePublishedAt(query.from);
    const toDate = query.to === undefined ? undefined : parsePublishedAt(query.to);

    if (query.from !== undefined && from === null) {
      throw new AppError(400, 'INVALID_FROM_DATE', 'from must be a valid date');
    }
    if (query.to !== undefined && toDate === null) {
      throw new AppError(400, 'INVALID_TO_DATE', 'to must be a valid date');
    }
    const parsedFrom = from ?? undefined;
    const parsedTo = toDate ?? undefined;
    const toIsDateOnly = query.to !== undefined && /^\d{4}-\d{2}-\d{2}$/u.test(query.to);

    if (parsedFrom !== undefined && parsedTo !== undefined && parsedFrom > parsedTo) {
      throw new AppError(400, 'INVALID_DATE_RANGE', 'from must not be after to');
    }

    const toExclusive = parsedTo === undefined
      ? undefined
      : new Date(parsedTo.getTime() + (toIsDateOnly ? 24 * 60 * 60 * 1000 : 1));

    const result = await service.search(pool, {
      q: query.q,
      source: query.source === undefined ? undefined : normalizeSource(query.source),
      from: parsedFrom,
      to: toExclusive,
      page: query.page,
      limit: query.limit
    });

    return reply.send({
      data: result.rows.map(serializeMention),
      meta: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        total_pages: Math.ceil(result.total / query.limit)
      }
    });
  });

  app.get('/mentions/stats', async (request, reply) => {
    const groupBy = parseStatsGroup((request.query as { group_by?: unknown }).group_by);
    const rows = groupBy === 'source' ? await service.statsBySource(pool) : await service.statsByDay(pool);
    return reply.send({
      data: rows.map((row) => ({ group: row.group, count: row.count }))
    });
  });
}

export { serializeMention };
