CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dedupe_key TEXT NOT NULL UNIQUE,
  external_id TEXT,
  source TEXT NOT NULL,
  source_raw TEXT NOT NULL,
  title TEXT,
  content_raw TEXT,
  content_text TEXT,
  url TEXT,
  url_canonical TEXT,
  author TEXT,
  published_at TIMESTAMPTZ,
  engagement BIGINT NOT NULL DEFAULT 0 CHECK (engagement >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mentions_source_idx ON mentions (source);
CREATE INDEX IF NOT EXISTS mentions_published_at_idx ON mentions (published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS mentions_url_canonical_idx ON mentions (url_canonical);
CREATE INDEX IF NOT EXISTS mentions_external_id_idx ON mentions (source, external_id);
