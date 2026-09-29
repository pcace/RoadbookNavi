import { describe, expect, it } from 'vitest';
import { calculateDistance } from './calcDistance';

describe('calculateDistance', () => {
  it('returns distances in meters and is symmetric', () => {
    const berlinToNearby = calculateDistance(52.52, 13.405, 52.53, 13.415);
    const nearbyToBerlin = calculateDistance(52.53, 13.415, 52.52, 13.405);

    expect(berlinToNearby).toBeGreaterThan(1000);
    expect(berlinToNearby).toBeLessThan(2000);
    expect(nearbyToBerlin).toBeCloseTo(berlinToNearby, 6);
    expect(calculateDistance(52.52, 13.405, 52.52, 13.405)).toBe(0);
  });
});
