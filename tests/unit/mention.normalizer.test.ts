import { describe, expect, it } from 'vitest';
import {
  buildDedupeKey,
  cleanContent,
  normalizeMention,
  normalizeSource,
  parseEngagement,
  parsePublishedAt
} from '../../src/modules/mentions/mention.normalizer.js';

const baseMention = {
  external_id: 'nst-40130',
  source: ' New Straits Times ',
  title: 'Flash floods',
  content: '<p>Floods</p><script>alert(1)</script>',
  url: 'https://www.nst.com.my/news/article#tracking',
  author: 'Author',
  published_at: '2026-08-13T11:20:00Z',
  engagement: '1,875'
};

describe('mention normalization', () => {
  it('canonicalizes source aliases and whitespace', () => {
    expect(normalizeSource(' TWITTER ')).toBe('twitter');
    expect(normalizeSource('malaysiakini ')).toBe('malaysiakini');
    expect(normalizeSource('thestar')).toBe('the star');
  });

  it('removes HTML and script content before search', () => {
    expect(cleanContent(baseMention.content)).toBe('Floods');
  });

  it('parses engagement strings and date formats', () => {
    expect(parseEngagement('3,402')).toBe(3402);
    expect(parsePublishedAt(1786435200)?.toISOString()).toBe('2026-08-11T08:00:00.000Z');
    expect(parsePublishedAt('11/08/2026')?.toISOString()).toBe('2026-08-10T16:00:00.000Z');
    expect(parsePublishedAt('2026-08-11')?.toISOString()).toBe('2026-08-10T16:00:00.000Z');
  });

  it('normalizes a messy seed record', () => {
    const result = normalizeMention(baseMention);
    expect(result.source).toBe('new straits times');
    expect(result.contentText).toBe('Floods');
    expect(result.urlCanonical).toBe('https://www.nst.com.my/news/article');
    expect(result.engagement).toBe(1875);
  });

  it('uses canonical URL before external id for duplicate identity', () => {
    expect(buildDedupeKey({
      source: 'the star',
      externalId: 'nst-40021',
      urlCanonical: 'https://www.thestar.com.my/article',
      title: 'Ringgit',
      contentText: 'Ringgit'
    })).toBe('url:https://www.thestar.com.my/article');
  });
});

it('returns null for missing publication dates', () => {
  expect(parsePublishedAt(null)).toBeNull();
  expect(parsePublishedAt('')).toBeNull();
});
