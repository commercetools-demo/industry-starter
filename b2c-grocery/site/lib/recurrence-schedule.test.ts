import { describe, it, expect } from 'vitest';
import { nextOccurrence } from './recurrence-schedule';

const now = new Date('2026-10-20T12:00:00.000Z');

describe('nextOccurrence', () => {
  it('weekly: the first start + n weeks after now', () => {
    expect(nextOccurrence('2026-10-06T22:20:26.306Z', { type: 'standard', value: 1, intervalUnit: 'Weeks' }, now)).toBe('2026-10-20T22:20:26.306Z');
  });

  it('every 2 weeks: skips whole periods that are already past', () => {
    expect(nextOccurrence('2026-09-01T08:00:00.000Z', { type: 'standard', value: 2, intervalUnit: 'Weeks' }, now)).toBe('2026-10-27T08:00:00.000Z');
  });

  it('starts in the future: that start', () => {
    expect(nextOccurrence('2026-11-01T08:00:00.000Z', { type: 'standard', value: 1, intervalUnit: 'Weeks' }, now)).toBe('2026-11-01T08:00:00.000Z');
  });

  it('monthly: calendar months, clamping the day', () => {
    expect(nextOccurrence('2026-01-31T08:00:00.000Z', { type: 'standard', value: 1, intervalUnit: 'Months' }, new Date('2026-02-10T00:00:00Z'))).toBe('2026-02-28T08:00:00.000Z');
    expect(nextOccurrence('2026-08-06T08:00:00.000Z', { type: 'standard', value: 1, intervalUnit: 'Months' }, now)).toBe('2026-11-06T08:00:00.000Z');
  });

  it('days', () => {
    expect(nextOccurrence('2026-10-19T00:00:00.000Z', { type: 'standard', value: 3, intervalUnit: 'Days' }, now)).toBe('2026-10-22T00:00:00.000Z');
  });

  it('day of month: this month if still ahead, else next month', () => {
    expect(nextOccurrence('2026-01-01T09:30:00.000Z', { type: 'dayOfMonth', day: 25 }, now)).toBe('2026-10-25T09:30:00.000Z');
    expect(nextOccurrence('2026-01-01T09:30:00.000Z', { type: 'dayOfMonth', day: 5 }, now)).toBe('2026-11-05T09:30:00.000Z');
  });

  it('unknown schedules and bad input give null', () => {
    expect(nextOccurrence('2026-10-06T00:00:00Z', { type: 'other' }, now)).toBeNull();
    expect(nextOccurrence('2026-10-06T00:00:00Z', { type: 'standard', value: 1, intervalUnit: 'Years' }, now)).toBeNull();
    expect(nextOccurrence('nope', { type: 'standard', value: 1, intervalUnit: 'Weeks' }, now)).toBeNull();
  });
});
