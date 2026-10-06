import { describe, expect, it } from 'vitest';
import { slotWindow } from './window';

describe('slotWindow', () => {
  it('derives start and end of a configured window', () => {
    expect(slotWindow('20261012-10')).toEqual({ start: '2026-10-12T10:00:00.000Z', end: '2026-10-12T12:00:00.000Z' });
    expect(slotWindow('20261012-18')?.end).toBe('2026-10-12T20:00:00.000Z');
  });
  it.each(['20261012-09', '20261312-10', '20261032-10', 'x', '2026-10-12-10', ''])('unknown id %s: null', (id) => {
    expect(slotWindow(id)).toBeNull();
  });
});
