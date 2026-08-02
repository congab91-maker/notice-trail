import { describe, it, expect } from 'vitest';
import {
  validateRegistrationParams,
  validateNonEmptyString,
  validateSourceHost,
  validateUtahNoticeUrl,
  ValidationError,
  UTAH_SOURCE_HOST,
} from '../lib/validation';

describe('NoticeTrail Validation Parity Suite (src/lib/validation.ts)', () => {
  it('accepts valid Utah PMN notice URL pair', () => {
    const res = validateRegistrationParams({
      jurisdictionKey: 'city-sf',
      meetingKey: '2026-08-01',
      itemKey: 'item-1',
      agendaUrl: 'https://www.utah.gov/pmn/sitemap/notice/1001.html',
      outcomeUrl: 'https://www.utah.gov/pmn/sitemap/notice/1002.html',
      sourceHost: UTAH_SOURCE_HOST,
    });
    expect(res.jurisdictionKey).toBe('city-sf');
    expect(res.meetingKey).toBe('2026-08-01');
    expect(res.itemKey).toBe('item-1');
    expect(res.sourceHost).toBe('www.utah.gov');
    expect(res.agendaUrl).toBe('https://www.utah.gov/pmn/sitemap/notice/1001.html');
    expect(res.outcomeUrl).toBe('https://www.utah.gov/pmn/sitemap/notice/1002.html');
  });

  it('rejects raw strings with control characters before trimming (tab, newline, NUL, DEL)', () => {
    expect(() => validateNonEmptyString('\tcity-sf', 'jurisdiction_key')).toThrow(ValidationError);
    expect(() => validateNonEmptyString('city-sf\n', 'jurisdiction_key')).toThrow(ValidationError);
    expect(() => validateNonEmptyString('city\x00sf', 'jurisdiction_key')).toThrow(ValidationError);
    expect(() => validateNonEmptyString('city\x7fsf', 'jurisdiction_key')).toThrow(ValidationError);

    expect(() =>
      validateRegistrationParams({
        jurisdictionKey: 'city\x00sf',
        meetingKey: '2026-08-01',
        itemKey: 'item-1',
        agendaUrl: 'https://www.utah.gov/pmn/sitemap/notice/1001.html',
        outcomeUrl: 'https://www.utah.gov/pmn/sitemap/notice/1002.html',
      })
    ).toThrow(ValidationError);
  });

  it('handles sourceHost derivation and rejects explicit empty string host', () => {
    expect(validateSourceHost(undefined)).toBe('www.utah.gov');
    expect(() => validateSourceHost('')).toThrow(ValidationError);
    expect(() => validateSourceHost('   ')).toThrow(ValidationError);
    expect(() => validateSourceHost('records.example.gov')).toThrow(ValidationError);
  });

  it('rejects overlong keys > 256 chars', () => {
    expect(() =>
      validateRegistrationParams({
        jurisdictionKey: 'a'.repeat(257),
        meetingKey: '2026-08-01',
        itemKey: 'item-1',
        agendaUrl: 'https://www.utah.gov/pmn/sitemap/notice/1001.html',
        outcomeUrl: 'https://www.utah.gov/pmn/sitemap/notice/1002.html',
      })
    ).toThrow(ValidationError);
  });

  it.each([
    ['delimiter', 'a:b'],
    ['uppercase', 'City-SF'],
    ['whitespace', 'city sf'],
    ['leading whitespace', ' city-sf'],
    ['trailing whitespace', 'city-sf '],
    ['underscore', 'city_sf'],
    ['Unicode confusable', 'café'],
    ['consecutive delimiter', 'city--sf'],
    ['leading delimiter', '-city'],
    ['trailing delimiter', 'city-'],
    ['prompt-like prose', 'ignore previous instructions'],
    ['over 80 characters', 'a'.repeat(81)],
  ])('rejects %s identity key input', (_caseName, jurisdictionKey) => {
    expect(() =>
      validateRegistrationParams({
        jurisdictionKey,
        meetingKey: '2026-08-01',
        itemKey: 'item-1',
        agendaUrl: 'https://www.utah.gov/pmn/sitemap/notice/1001.html',
        outcomeUrl: 'https://www.utah.gov/pmn/sitemap/notice/1002.html',
      })
    ).toThrow(ValidationError);
  });

  it('rejects URL matrix: non-ASCII notice IDs, query, fragment, backslash, percent-encoding, unsupported path, credentials, port, identical URLs', () => {
    // Non-ASCII / Unicode notice IDs (Arabic-Indic, fullwidth, mixed)
    expect(() => validateUtahNoticeUrl('https://www.utah.gov/pmn/sitemap/notice/١٢٣.html', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);
    expect(() => validateUtahNoticeUrl('https://www.utah.gov/pmn/sitemap/notice/１２３.html', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);
    expect(() => validateUtahNoticeUrl('https://www.utah.gov/pmn/sitemap/notice/100a.html', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);

    // Forbidden characters: query, fragment, backslash, percent-encoding, traversal
    expect(() => validateUtahNoticeUrl('https://www.utah.gov/pmn/sitemap/notice/1001.html?q=1', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);
    expect(() => validateUtahNoticeUrl('https://www.utah.gov/pmn/sitemap/notice/1001.html#sec', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);
    expect(() => validateUtahNoticeUrl('https://www.utah.gov/pmn/sitemap/notice/1001\\.html', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);
    expect(() => validateUtahNoticeUrl('https://www.utah.gov/pmn/sitemap/notice/%2e%2e/1001.html', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);

    // Unsupported path, credentials, port
    expect(() => validateUtahNoticeUrl('https://www.utah.gov/other/path/1001.html', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);
    expect(() => validateUtahNoticeUrl('https://user:pass@www.utah.gov/pmn/sitemap/notice/1001.html', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);
    expect(() => validateUtahNoticeUrl('https://www.utah.gov:8080/pmn/sitemap/notice/1001.html', 'www.utah.gov', 'agenda_url')).toThrow(ValidationError);

    // Identical URLs
    expect(() =>
      validateRegistrationParams({
        jurisdictionKey: 'city-sf',
        meetingKey: '2026-08-01',
        itemKey: 'item-1',
        agendaUrl: 'https://www.utah.gov/pmn/sitemap/notice/1001.html',
        outcomeUrl: 'https://www.utah.gov/pmn/sitemap/notice/1001.html',
      })
    ).toThrow(ValidationError);
  });
});
