# Media Monitoring API

Small backend service for ingesting, searching, and aggregating media mentions.

## Stack

- Node.js 20+
- TypeScript
- Fastify
- PostgreSQL 16
- `pg` with explicit SQL queries
- Zod for request validation
- Vitest for tests
- Vanilla HTML/CSS/JavaScript dashboard served by Fastify

## Run locally

Requirements: Node.js, npm, and Docker Desktop.

```bash
npm install
copy .env.example .env
npm run build
docker compose up -d
npm run migrate
npm run dev
```

On macOS/Linux, use `cp .env.example .env` instead of `copy`.

The API is available at `http://localhost:3000`. The read-only dashboard is available at `http://localhost:3000/`.

Health endpoints:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/ready
```

`/health` checks that the process is alive. `/ready` checks database connectivity.

To stop PostgreSQL:

```bash
docker compose down
```

The database data is stored in the Docker volume `mentions_pgdata`. To remove it as well:

```bash
docker compose down -v
```

## Seed the sample data

The bulk endpoint accepts the array from `seed_mentions.json`. For a public deployment, set `INGEST_API_KEY` and send it using the `x-api-key` header. Leave it unset for the local assessment workflow.

```bash
curl -X POST http://localhost:3000/internal/mentions/bulk \
  -H "content-type: application/json" \
  --data-binary @seed_mentions.json
```

Example response:

```json
{
  "data": {
    "received": 15,
    "inserted": 13,
    "updated": 2,
    "duplicates": 2
  }
}
```

The exact counts are determined by the deduplication keys. Sending the same file again does not create additional rows.

## API

### `POST /internal/mentions/bulk`

Accepts a JSON array with these fields:

```json
[
  {
    "external_id": "str-99120",
    "source": "The Star",
    "title": "Ringgit strengthens against US dollar in early trade",
    "content": "<p>The ringgit opened higher.</p>",
    "url": "https://example.com/article",
    "author": "Aisyah Rahman",
    "published_at": "2026-08-10T08:15:00Z",
    "engagement": "1,204"
  }
]
```

The operation runs in one PostgreSQL transaction. Invalid payloads return `400`; valid records are normalized and upserted.

### `GET /mentions`

Supported query parameters:

| Parameter | Description |
| --- | --- |
| `q` | Case-insensitive substring search across title and cleaned content. |
| `source` | Canonical source filter, for example `twitter` or `the star`. |
| `from` | Inclusive publication date/time lower bound. A date-only value starts at midnight in Malaysia time. |
| `to` | Inclusive publication date upper bound. A date-only value includes the entire day in Malaysia time. |
| `page` | 1-based page number; default `1`. |
| `limit` | Results per page; default `20`, maximum `100`. |

Sorting is stable and documented: `published_at DESC NULLS LAST, id DESC`.

Examples:

```bash
curl "http://localhost:3000/mentions?q=ringgit&page=1&limit=10"
curl "http://localhost:3000/mentions?source=TWITTER"
curl "http://localhost:3000/mentions?from=2026-08-10&to=2026-08-15"
```

Response shape:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "total_pages": 0
  }
}
```

### `GET /mentions/stats?group_by=source|day`

Examples:

```bash
curl "http://localhost:3000/mentions/stats?group_by=source"
curl "http://localhost:3000/mentions/stats?group_by=day"
```

`source` groups by canonical source. `day` groups by the UTC calendar date of `published_at`; records without a publication date are excluded from day statistics.

## Schema

The schema is created by `src/db/migrations/001_create_mentions.sql` and applied by `npm run migrate`.

### `mentions`

| Column | Purpose |
| --- | --- |
| `id` | Internal UUID primary key. |
| `dedupe_key` | Deterministic unique identity used for idempotent upsert. |
| `external_id` | Source-provided identifier. |
| `source` | Canonical source used by filtering and stats. |
| `source_raw` | Original source value for auditability. |
| `title` | Trimmed title, nullable for social posts. |
| `content_raw` | Original content, retained for audit. |
| `content_text` | HTML-free content used for search and API responses. |
| `url` | Original URL. |
| `url_canonical` | Canonical URL used by duplicate detection. |
| `author` | Trimmed author/handle, nullable. |
| `published_at` | Normalized `TIMESTAMPTZ`, nullable. |
| `engagement` | Non-negative integer engagement count. |
| `created_at` / `updated_at` | Record timestamps. |

Indexes exist for source, publication time, canonical URL, and `(source, external_id)`.

## Normalization decisions

- Source names are trimmed, lowercased, and collapsed to canonical aliases. For example, `The Star`, `thestar`, and `THESTAR` become `the star`; `TWITTER` becomes `twitter`.
- Empty title and author strings become `NULL`.
- HTML tags and active elements such as `script` are removed from `content_text`. The original value remains in `content_raw`.
- ISO-8601 values and values with offsets are parsed as supplied.
- Unix numeric timestamps are interpreted as seconds since Unix epoch.
- A datetime without timezone is assumed to be Malaysia time (`+08:00`) because the dataset is Malaysia-focused.
- `DD/MM/YYYY` is interpreted as day/month/year.
- Commas are removed from engagement strings, so `"3,402"` becomes `3402`.
- URL canonicalization lowercases the hostname, removes fragments, and trims trailing path slashes. Query parameters are retained conservatively.

## Duplicate rule

A deterministic `dedupe_key` is chosen in this order:

1. `url:<canonical URL>` when a valid URL exists.
2. `external:<canonical source>:<external_id>` when no URL exists.
3. A SHA-256 hash of normalized source, title, and content as a final fallback.

This means the same URL is treated as the same mention even when the source label or external ID differs. This correctly catches the three sample records that point to the same The Star article. We use the URL before external ID because source IDs can be inconsistent across ingestion systems, as shown by the sample. We do not merge similar titles or related stories with different URLs because syndicated articles and social posts can be related without being the same record.

Conflicts use PostgreSQL `ON CONFLICT`. The latest normalized payload updates the record, while engagement uses the maximum of the existing and incoming values so a retry or stale source snapshot cannot reduce the stored metric.

## Assumptions and trade-offs

- This service stores one current row per deduplicated mention; it does not keep a historical engagement time series. A production system needing historical charts would use a separate metrics table.
- Content search uses PostgreSQL `ILIKE` substring matching. It is simple and works for this assessment, but PostgreSQL full-text search or a search engine would scale better for large multilingual content.
- Date-only filters use Malaysia time and are converted to UTC for PostgreSQL. Daily stats use UTC dates for a stable, explicit definition.
- A malformed URL or unparseable engagement/date is rejected instead of silently storing misleading data.
- Authentication is not part of the assessment contract. An optional `INGEST_API_KEY` protects the bulk endpoint when the service is deployed publicly, while local development can leave it unset.
- No ORM is used so the schema and SQL remain visible and reviewable.
- The bulk operation is transactional: a validation or database failure rolls back the whole request. This favors consistency over partial ingestion.

## Tests

```bash
npm test
npm run build
```

The tests focus on the riskiest logic:

- source, content, URL, engagement, and date normalization;
- script removal before content search;
- canonical URL duplicate identity;
- bulk transaction and duplicate counters;
- invalid stats query validation;
- dashboard, health, and optional ingestion API-key routes.

## Assessment deliverables

- Public repository or private zip containing this project.
- This README documents setup, schema, duplicate detection, assumptions, and trade-offs.
- Commit history should be created in meaningful stages rather than as one dump.
- No frontend is required.

### Time spent

Fill this section before submitting. Record the approximate total hours and number of working sessions honestly.

- Total: `6 hours`
- Sessions: `1`

### With another week, I would…

- Add PostgreSQL full-text search with a language-aware search configuration.
- Add a separate engagement history table for time-series charts.
- Add an integration test suite running against PostgreSQL migrations in Docker.
- Add structured ingestion error reporting per record and basic metrics/logging.
- Add OpenAPI documentation.

## Dashboard

The optional dashboard is served by the same Fastify process, so it does not require CORS or a separate frontend deployment. It calls only the read-only endpoints and displays:

- total deduplicated mentions;
- searchable and filterable recent mentions;
- source distribution;
- daily publication trend.

Open `http://localhost:3000/` after starting the API. The dashboard uses the cleaned `content` field and treats external URLs as untrusted links.

## Deploy to Render

The repository includes `render.yaml` for a Render Blueprint with one free Web Service and one PostgreSQL database.

1. Push this repository to GitHub.
2. In Render, choose **New → Blueprint** and select the repository.
3. Review the generated Web Service and PostgreSQL database.
4. Apply the Blueprint. Render runs `npm ci --include=dev && npm run build`, then starts the service with `npm run migrate:prod && npm start`.
5. Open the deployed service URL. The dashboard is at `/`, the liveness check is `/health`, and database readiness is `/ready`.

Render provides `DATABASE_URL` from the managed database. `INGEST_API_KEY` is generated by the Blueprint, so public bulk ingestion requires:

```bash
curl -X POST https://YOUR-SERVICE.onrender.com/internal/mentions/bulk \
  -H "content-type: application/json" \
  -H "x-api-key: YOUR_INGEST_API_KEY" \
  --data-binary @seed_mentions.json
```

The free service may sleep after inactivity, so the first request can be slower. Do not commit `.env` or any database credentials.

  ## Deployed demo
    https://media-monitoring-api.onrender.com/