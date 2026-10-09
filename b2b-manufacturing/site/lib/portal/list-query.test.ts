import { describe, expect, it } from 'vitest';
import { diversionRate, monthsWithNotes, pick, sortRows, sortState, toQuery } from './list-query';

const notes = [
  { date: '2026-10-03', kind: 'Transfer note', recycledKg: 600, totalKg: 1000 },
  { date: '2026-10-20', kind: 'Consignment note', recycledKg: 100, totalKg: 200 },
  { date: '2026-05-01', kind: 'Transfer note', recycledKg: 300, totalKg: 800 },
  { date: '2025-10-15', kind: 'Transfer note', recycledKg: 50, totalKg: 50 },
  { date: '2025-11-15', kind: 'Transfer note', recycledKg: 0, totalKg: 100 },
  { date: '2026-10-05', kind: 'Annual report', recycledKg: 9999, totalKg: 9999 },
];

describe('malva-client-portal › Diversion rate', () => {
  it('month and trailing twelve months from the weights; annual reports are not counted', () => {
    const r = diversionRate(notes, '2026-10');
    expect(r.month).toEqual({ month: '2026-10', recycledKg: 700, totalKg: 1200, rate: 58.3 });
    expect(r.trailing).toEqual({ month: '2026-10', recycledKg: 1000, totalKg: 2100, rate: 47.6 });
  });
  it('has no rate for a month without weights, and lists months newest first', () => {
    expect(diversionRate(notes, '2026-09').month).toEqual({ month: '2026-09', recycledKg: 0, totalKg: 0, rate: null });
    expect(monthsWithNotes(notes)).toEqual(['2026-10', '2026-05', '2025-11', '2025-10']);
  });
});

describe('malva-client-portal › list query helpers', () => {
  it('ignores values that are not allowed', () => { expect(pick('x', ['a'])).toBe(''); expect(pick(['a', 'b'], ['a', 'b'])).toBe('a'); });
  it('sort state falls back to the defaults', () => {
    expect(sortState({ sort: 'evil', dir: 'up' }, ['date'], { sort: 'date', dir: 'desc' })).toEqual({ sort: 'date', dir: 'desc' });
    expect(sortState({ sort: 'site', dir: 'asc' }, ['date', 'site'], { sort: 'date', dir: 'desc' })).toEqual({ sort: 'site', dir: 'asc' });
  });
  it('sorts text and numbers in both directions; builds a query string without empty values', () => {
    const rows = [{ n: 2, s: 'b' }, { n: 10, s: 'a' }];
    expect(sortRows(rows, 'n', 'asc', (r, k) => (k === 'n' ? r.n : r.s)).map((r) => r.n)).toEqual([2, 10]);
    expect(sortRows(rows, 's', 'asc', (r) => r.s).map((r) => r.s)).toEqual(['a', 'b']);
    expect(toQuery({ site: 's1', status: '' })).toBe('?site=s1');
    expect(toQuery({ site: '' })).toBe('');
  });
});
