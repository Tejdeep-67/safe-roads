import { describe, expect, it } from 'vitest';
import { boundsKey, buildQuery, parseFeatures, snapBounds } from './overpass';

describe('overpass helpers', () => {
  it('builds a query for the four kinds of traffic calming inside the box', () => {
    const q = buildQuery({ south: 16.29, west: 80.42, north: 16.31, east: 80.45 });
    expect(q).toContain('node["traffic_calming"~"^(bump|hump|table|cushion)$"](16.29,80.42,16.31,80.45)');
    expect(q).toContain('out body 500');
  });

  it('snaps the box outwards so nearby pans share one request', () => {
    const a = snapBounds({ south: 16.2912, west: 80.4211, north: 16.3008, east: 80.4502 });
    expect(a).toEqual({ south: 16.29, west: 80.42, north: 16.31, east: 80.46 });
    const b = snapBounds({ south: 16.2933, west: 80.4244, north: 16.3005, east: 80.4588 });
    expect(boundsKey(a)).toBe(boundsKey(b));
  });

  it('keeps only valid nodes with a wanted traffic_calming value', () => {
    const out = parseFeatures({
      elements: [
        { type: 'node', id: 1, lat: 16.3, lon: 80.4, tags: { traffic_calming: 'bump' } },
        { type: 'node', id: 2, lat: 16.3, lon: 80.4, tags: { traffic_calming: 'chicane' } },
        { type: 'node', id: 3, lat: 16.3, tags: { traffic_calming: 'hump' } },
        { type: 'way', id: 4, lat: 16.3, lon: 80.4, tags: { traffic_calming: 'table' } },
        { type: 'node', id: 5, lat: 16.31, lon: 80.41, tags: { traffic_calming: 'table', name: 'x'.repeat(100) } },
      ],
    });
    expect(out.map((f) => f.id)).toEqual([1, 5]);
    expect(out[1].name).toHaveLength(60);
  });

  it('survives garbage', () => {
    expect(parseFeatures(null)).toEqual([]);
    expect(parseFeatures({ elements: 'nope' })).toEqual([]);
  });
});
