import { describe, expect, it } from 'vitest';
import { cleanBbox, DEFAULT_QUERY, feedPath } from './feedUrl';

describe('feed url builder', () => {
  it('gives the plain feed for the default choices', () => {
    expect(feedPath('geojson', DEFAULT_QUERY)).toBe('/api/feed/geojson');
    expect(feedPath('csv', DEFAULT_QUERY, 1)).toBe('/api/feed/csv?limit=1');
  });
  it('adds only what differs from the default', () => {
    const q = { ...DEFAULT_QUERY, types: ['pothole', 'waterlogging'] as const, severities: ['high'] as const, status: 'all' as const, verifiedOnly: true, since: '2026-01-01', bbox: '80.3,16.2,80.6,16.5' };
    expect(feedPath('json', { ...q, types: [...q.types], severities: [...q.severities] })).toBe(
      '/api/feed/json?bbox=80.3,16.2,80.6,16.5&type=pothole,waterlogging&severity=high&status=all&verified=1&since=2026-01-01',
    );
  });
  it('treats "every type" and "every severity" as no filter', () => {
    const all = { ...DEFAULT_QUERY, types: ['pothole', 'waterlogging', 'broken_edge', 'open_manhole', 'speed_bump'] as const, severities: ['low', 'medium', 'high'] as const };
    expect(feedPath('geojson', { ...all, types: [...all.types], severities: [...all.severities] })).toBe('/api/feed/geojson');
  });
  it('accepts only a sane bounding box', () => {
    expect(cleanBbox('80.3, 16.2, 80.6, 16.5')).toBe('80.3,16.2,80.6,16.5');
    expect(cleanBbox('')).toBe('');
    expect(cleanBbox('1,2,3')).toBe('');
    expect(cleanBbox('80.6,16.2,80.3,16.5')).toBe('');
    expect(cleanBbox('a,b,c,d')).toBe('');
    expect(cleanBbox('0,0,200,10')).toBe('');
  });
});
