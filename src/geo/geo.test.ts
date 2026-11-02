import { describe, expect, it } from 'vitest';
import { cumulative, haversine, hazardsNearRoute, locateOnRoute, pointAlong, pointToSegment, type LatLng } from './geo';

describe('haversine', () => {
  it('Guntur to Vijayawada is about 28 km in a straight line', () => {
    const d = haversine([16.3067, 80.4365], [16.5062, 80.648]);
    expect(d / 1000).toBeGreaterThan(30);
    expect(d / 1000).toBeLessThan(33);
  });
  it('0.001 deg latitude is about 111 m', () => {
    expect(haversine([16, 80], [16.001, 80])).toBeCloseTo(111.2, 0);
  });
});

describe('pointToSegment', () => {
  const a: LatLng = [16.3, 80.43];
  const b: LatLng = [16.3, 80.44]; // ~1 km east-west segment
  it('distance to the middle of the segment', () => {
    const p: LatLng = [16.3002, 80.435]; // ~22 m north of the middle
    const hit = pointToSegment(p, a, b);
    expect(hit.dist).toBeGreaterThan(20);
    expect(hit.dist).toBeLessThan(24);
    expect(hit.t).toBeCloseTo(0.5, 1);
  });
  it('clamps to the end point when past the segment', () => {
    const p: LatLng = [16.3, 80.45];
    const hit = pointToSegment(p, a, b);
    expect(hit.t).toBe(1);
    expect(hit.dist).toBeCloseTo(haversine(p, b), -1);
  });
});

describe('route helpers', () => {
  const route: LatLng[] = [
    [16.3, 80.43],
    [16.3, 80.44],
    [16.31, 80.44],
  ];
  it('finds hazards inside the buffer, ordered along the route', () => {
    const hazards = [
      { id: 'far', lat: 16.305, lng: 80.435 }, // ~550 m off route
      { id: 'second', lat: 16.305, lng: 80.4401 }, // on the 2nd leg
      { id: 'first', lat: 16.3001, lng: 80.432 }, // on the 1st leg
    ];
    const near = hazardsNearRoute(route, hazards, 30);
    expect(near.map((n) => n.item.id)).toEqual(['first', 'second']);
    expect(near[0].along).toBeLessThan(near[1].along);
  });
  it('locates a position and walks along the route', () => {
    const cum = cumulative(route);
    const mid = pointAlong(route, cum[1] + 100, cum);
    const pos = locateOnRoute(mid, route, cum);
    expect(pos.dist).toBeLessThan(1);
    expect(pos.along).toBeCloseTo(cum[1] + 100, 0);
  });
});
