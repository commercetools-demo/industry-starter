import { describe, expect, it } from 'vitest';
import { flagFor, markerPosition, rangeLabel } from './labs';

describe('flagFor', () => {
  it.each([
    [14.2, 12, 17.5, 'normal'],
    [12, 12, 17.5, 'normal'],
    [17.5, 12, 17.5, 'normal'],
    [148, 0, 100, 'high'],
    [19, 30, 100, 'low'],
    [0, 0, 100, 'normal'],
  ])('%s in %s-%s is %s', (value, low, high, flag) => {
    expect(flagFor(value, low, high)).toBe(flag);
  });
});

describe('markerPosition', () => {
  it.each([
    [14.2, 12, 17.5, 40],
    [148, 0, 100, 96],
    [19, 30, 100, 4],
    [12, 12, 17.5, 4],
    [5, 5, 5, 4],
    [6, 5, 5, 96],
  ])('%s in %s-%s sits at about %s', (value, low, high, expected) => {
    expect(markerPosition(value, low, high)).toBeCloseTo(expected, 0);
  });
  it('always stays within 4-96', () => {
    for (const v of [-50, 0, 10, 99, 1e6]) {
      const p = markerPosition(v, 10, 20);
      expect(p).toBeGreaterThanOrEqual(4);
      expect(p).toBeLessThanOrEqual(96);
    }
  });
});

describe('rangeLabel', () => {
  it('uses "< N" when the lower bound is 0', () => expect(rangeLabel(0, 200, 'mg/dL')).toBe('< 200 mg/dL'));
  it('uses "low – high" otherwise', () => expect(rangeLabel(12, 17.5, 'g/dL')).toBe('12 – 17.5 g/dL'));
  it('omits an empty unit', () => expect(rangeLabel(4, 5.7, '')).toBe('4 – 5.7'));
});
