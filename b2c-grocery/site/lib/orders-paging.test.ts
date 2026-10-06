import { describe, it, expect } from 'vitest';
import { parsePage } from './orders-paging';

describe('parsePage', () => {
  it('positive integers pass; everything else is page 1', () => {
    expect(parsePage('2')).toBe(2);
    expect(parsePage('12')).toBe(12);
    for (const bad of [null, undefined, '', '0', '-1', '1.5', 'abc']) expect(parsePage(bad)).toBe(1);
  });
});
