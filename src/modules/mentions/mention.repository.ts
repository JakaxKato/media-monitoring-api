import type { PoolClient } from 'pg';
import type { MentionRow, NormalizedMention, QueryClient, SearchParams, SearchResult, StatRow } from './mention.types.js';

function mapMentionRow(row: Record<string, unknown>): MentionRow {
  return {
    id: String(row.id),
    dedupeKey: String(row.dedupe_key),
    externalId: String(row.external_id),
    source: String(row.source),
    sourceRaw: String(row.source_raw),
    title: row.title === null ? null : String(row.title),
    contentRaw: String(row.content_raw),
    contentText: String(row.content_text),
    url: row.url === null ? null : String(row.url),
    urlCanonical: row.url_canonical === null ? null : String(row.url_canonical),
    author: row.author === null ? null : String(row.author),
    publishedAt: row.published_at as Date | null,
    engagement: Number(row.engagement),
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date
  };
}

export class MentionRepository {
  async upsert(client: QueryClient, mention: NormalizedMention): Promise<{ inserted: boolean; row: MentionRow }> {
    const result = await client.query(
      `
        INSERT INTO mentions (
          dedupe_key, external_id, source, source_raw, title, content_raw,
          content_text, url, url_canonical, author, published_at, engagement
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (dedupe_key) DO UPDATE SET
          external_id = EXCLUDED.external_id,
          source = EXCLUDED.source,
          source_raw = EXCLUDED.source_raw,
          title = EXCLUDED.title,
          content_raw = EXCLUDED.content_raw,
          content_text = EXCLUDED.content_text,
          url = EXCLUDED.url,
          url_canonical = EXCLUDED.url_canonical,
          author = EXCLUDED.author,
          published_at = EXCLUDED.published_at,
          engagement = GREATEST(mentions.engagement, EXCLUDED.engagement),
          updated_at = NOW()
        RETURNING *, (xmax = 0) AS inserted
      `,
      [
        mention.dedupeKey,
        mention.externalId,
        mention.source,
        mention.sourceRaw,
        mention.title,
        mention.contentRaw,
        mention.contentText,
        mention.url,
        mention.urlCanonical,
        mention.author,
        mention.publishedAt,
        mention.engagement
      ]
    );

    return {
      inserted: Boolean(result.rows[0].inserted),
      row: mapMentionRow(result.rows[0])
    };
  }

  async search(client: QueryClient, params: SearchParams): Promise<SearchResult> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.q !== undefined) {
      values.push(`%${params.q}%`);
      conditions.push(`(title ILIKE $${values.length} OR content_text ILIKE $${values.length})`);
    }
    if (params.source !== undefined) {
      values.push(params.source);
      conditions.push(`source = $${values.length}`);
    }
    if (params.from !== undefined) {
      values.push(params.from);
      conditions.push(`published_at >= $${values.length}`);
    }
    if (params.to !== undefined) {
      values.push(params.to);
      conditions.push(`published_at < $${values.length}`);
    }

    const where = conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`;
    const countResult = await client.query(`SELECT COUNT(*)::int AS total FROM mentions ${where}`, values);
    const total = Number(countResult.rows[0].total);
    const offset = (params.page - 1) * params.limit;

    values.push(params.limit, offset);
    const rowsResult = await client.query(
      `
        SELECT * FROM mentions
        ${where}
        ORDER BY published_at DESC NULLS LAST, id DESC
        LIMIT $${values.length - 1} OFFSET $${values.length}
      `,
      values
    );

    return { rows: rowsResult.rows.map(mapMentionRow), total };
  }

  async statsBySource(client: QueryClient): Promise<StatRow[]> {
    const result = await client.query(`
      SELECT source AS group, COUNT(*)::int AS count
      FROM mentions
      GROUP BY source
      ORDER BY count DESC, source ASC
    `);
    return result.rows.map((row) => ({ group: String(row.group), count: Number(row.count) }));
  }

  async statsByDay(client: QueryClient): Promise<StatRow[]> {
    const result = await client.query(`
      SELECT (published_at AT TIME ZONE 'UTC')::date::text AS day, COUNT(*)::int AS count
      FROM mentions
      WHERE published_at IS NOT NULL
      GROUP BY (published_at AT TIME ZONE 'UTC')::date
      ORDER BY day ASC
    `);
    return result.rows.map((row) => ({ group: String(row.day), count: Number(row.count) }));
  }
}

export type MentionDb = {
  pool: QueryClient & { connect: () => Promise<PoolClient> };
  repository: MentionRepository;
};
