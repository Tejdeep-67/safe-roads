import { describe, expect, it } from 'vitest';
import { activeFilterCount, applyFilters, DEFAULT_FILTERS, isDefault, parseFilters } from './filters';
import { trustLine } from './trust';
import type { Hazard } from './types';

const h = (o: Partial<Hazard>): Hazard => ({
  id: 'x', lat: 0, lng: 0, type: 'pothole', severity: 'medium', confidence: null, potholes: 1, source: 'manual', note: '',
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', status: 'open', verified: false, confirmations: 1,
  fixedVotes: 0, mine: false, myVote: null, hasPhoto: false, ...o,
});

describe('map filters', () => {
  const list = [
    h({ id: 'a' }),
    h({ id: 'b', type: 'waterlogging' }),
    h({ id: 'c', status: 'resolved' }),
    h({ id: 'd', verified: true, confirmations: 3 }),
    h({ id: 'e', status: 'resolved', type: 'speed_bump', mine: true }),
  ];
  const ids = (f = DEFAULT_FILTERS) => applyFilters(list, f).map((x) => x.id);

  it('hides fixed reports by default but always draws my own', () => {
    expect(ids()).toEqual(['a', 'b', 'd', 'e']);
    expect(ids({ ...DEFAULT_FILTERS, showFixed: true })).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
  it('filters by type and by verified', () => {
    expect(ids({ ...DEFAULT_FILTERS, types: ['waterlogging'] })).toEqual(['b', 'e']);
    expect(ids({ ...DEFAULT_FILTERS, verifiedOnly: true })).toEqual(['d', 'e']);
  });
  it('reads saved filters defensively', () => {
    expect(parseFilters(null)).toEqual(DEFAULT_FILTERS);
    expect(parseFilters('{nope')).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(JSON.stringify({ types: ['ufo'], showFixed: 1 }))).toEqual(DEFAULT_FILTERS);
    expect(parseFilters(JSON.stringify({ types: ['pothole'], showFixed: true })).types).toEqual(['pothole']);
  });
  it('counts what differs from the default', () => {
    expect(isDefault(DEFAULT_FILTERS)).toBe(true);
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ types: ['pothole'], showFixed: true, verifiedOnly: false, roadFeatures: true })).toBe(3);
  });
});

describe('trust line', () => {
  it('says what the community knows', () => {
    expect(trustLine({ status: 'open', verified: false, confirmations: 1, fixedVotes: 0 })).toMatch(/Not confirmed/);
    expect(trustLine({ status: 'open', verified: true, confirmations: 3, fixedVotes: 0 })).toBe('Confirmed by 3 people');
    expect(trustLine({ status: 'resolved', verified: true, confirmations: 1, fixedVotes: 2 })).toMatch(/2 people say so/);
  });
});
