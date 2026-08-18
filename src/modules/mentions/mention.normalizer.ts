import { createHash } from 'node:crypto';
import sanitizeHtml from 'sanitize-html';
import { AppError } from '../../shared/errors.js';
import type { MentionInput, NormalizedMention } from './mention.types.js';

const DEFAULT_TIMEZONE_OFFSET = '+08:00';

function cleanNullable(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const cleaned = value.trim();
  return cleaned === '' ? null : cleaned;
}

export function normalizeSource(value: string): string {
  const source = value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const aliases: Record<string, string> = {
    thestar: 'the star',
    'the star': 'the star',
    twitter: 'twitter',
    facebook: 'facebook',
    instagram: 'instagram',
    malaysiakini: 'malaysiakini',
    'new straits times': 'new straits times'
  };

  return aliases[source] ?? source;
}

export function normalizeTitle(value: string | null): string | null {
  return cleanNullable(value);
}

export function cleanContent(value: string): string {
  const cleaned = sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard'
  });

  return cleaned.replace(/\s+/g, ' ').trim();
}

export function canonicalizeUrl(value: string | null): string | null {
  const trimmed = cleanNullable(value);
  if (trimmed === null) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    url.hostname = url.hostname.toLocaleLowerCase();
    url.hash = '';
    if (url.pathname.length > 1) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    return url.toString();
  } catch {
    throw new AppError(400, 'INVALID_URL', `Invalid URL: ${value}`);
  }
}

function parseDateParts(year: string, month: string, day: string): Date {
  const yearNumber = Number(year);
  const monthNumber = Number(month);
  const dayNumber = Number(day);
  const daysInMonth = new Date(Date.UTC(yearNumber, monthNumber, 0)).getUTCDate();

  if (monthNumber < 1 || monthNumber > 12 || dayNumber < 1 || dayNumber > daysInMonth) {
    throw new AppError(400, 'INVALID_PUBLISHED_AT', 'Invalid published_at date');
  }

  return new Date(`${year}-${month}-${day}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
}

export function parsePublishedAt(value: string | number | null): Date | null {
  if (value === null || value === '') {
    return null;
  }

  if (typeof value === 'number') {
    const date = new Date(value * 1000);
    if (Number.isNaN(date.getTime())) {
      throw new AppError(400, 'INVALID_PUBLISHED_AT', 'Invalid Unix published_at value');
    }
    return date;
  }

  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(trimmed);
  if (dateOnly) {
    return parseDateParts(dateOnly[1], dateOnly[2], dateOnly[3]);
  }

  const localDateTime = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/u.exec(trimmed);
  if (localDateTime) {
    parseDateParts(localDateTime[1].slice(0, 4), localDateTime[1].slice(5, 7), localDateTime[1].slice(8, 10));
    const date = new Date(`${localDateTime[1]}T${localDateTime[2]}${DEFAULT_TIMEZONE_OFFSET}`);
    if (Number.isNaN(date.getTime())) {
      throw new AppError(400, 'INVALID_PUBLISHED_AT', `Invalid published_at value: ${value}`);
    }
    return date;
  }

  const dayFirstDate = /^(\d{2})\/(\d{2})\/(\d{4})$/u.exec(trimmed);
  if (dayFirstDate) {
    return parseDateParts(dayFirstDate[3], dayFirstDate[2], dayFirstDate[1]);
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'INVALID_PUBLISHED_AT', `Invalid published_at value: ${value}`);
  }
  return date;
}

export function parseEngagement(value: string | number): number {
  const normalized = typeof value === 'number' ? String(value) : value.replace(/,/g, '').trim();
  if (!/^\d+$/u.test(normalized)) {
    throw new AppError(400, 'INVALID_ENGAGEMENT', `Invalid engagement value: ${value}`);
  }

  const engagement = Number(normalized);
  if (!Number.isSafeInteger(engagement)) {
    throw new AppError(400, 'INVALID_ENGAGEMENT', `Engagement is outside the safe integer range: ${value}`);
  }
  return engagement;
}

function normalizeForHash(value: string | null): string {
  return (value ?? '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function buildDedupeKey(values: {
  source: string;
  externalId: string;
  urlCanonical: string | null;
  title: string | null;
  contentText: string;
}): string {
  if (values.urlCanonical !== null) {
    return `url:${values.urlCanonical}`;
  }

  if (values.externalId !== '') {
    return `external:${values.source}:${values.externalId}`;
  }

  const fallback = [values.source, normalizeForHash(values.title), normalizeForHash(values.contentText)].join('|');
  return `hash:${createHash('sha256').update(fallback).digest('hex')}`;
}

export function normalizeMention(input: MentionInput): NormalizedMention {
  const source = normalizeSource(input.source);
  const title = normalizeTitle(input.title);
  const contentText = cleanContent(input.content);
  const urlCanonical = canonicalizeUrl(input.url);

  return {
    dedupeKey: buildDedupeKey({
      source,
      externalId: input.external_id,
      urlCanonical,
      title,
      contentText
    }),
    externalId: input.external_id,
    source,
    sourceRaw: input.source,
    title,
    contentRaw: input.content,
    contentText,
    url: cleanNullable(input.url),
    urlCanonical,
    author: cleanNullable(input.author),
    publishedAt: parsePublishedAt(input.published_at),
    engagement: parseEngagement(input.engagement)
  };
}
