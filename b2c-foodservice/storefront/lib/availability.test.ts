import { describe, expect, it } from 'vitest';
import { availabilityState } from '@/lib/availability';

describe('availabilityState', () => {
  it('zero is out', () => {
    expect(availabilityState(0, 5)).toBe('out');
    expect(availabilityState(-2, 5)).toBe('out');
  });
  it('at threshold is low', () => {
    expect(availabilityState(5, 5)).toBe('low');
    expect(availabilityState(1, 5)).toBe('low');
  });
  it('above threshold is in', () => {
    expect(availabilityState(6, 5)).toBe('in');
  });
});
