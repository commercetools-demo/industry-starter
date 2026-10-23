import { describe, expect, it } from 'vitest';
import { todayHours } from '@/lib/hours';
import type { OpeningHours } from '@/lib/types';

const HOURS: OpeningHours = {
  mon: { open: '07:00', close: '18:00' },
  tue: { open: '07:00', close: '18:00' },
  wed: { open: '07:00', close: '18:00' },
  thu: { open: '07:00', close: '18:00' },
  fri: { open: '07:00', close: '19:00' },
  sat: { open: '08:00', close: '19:00' },
  sun: null,
};

describe('todayHours', () => {
  it('open today shows hours', () => {
    const wednesdayNoon = new Date('2026-10-21T16:00:00Z'); // Wednesday in New York
    expect(todayHours({ hours: HOURS }, wednesdayNoon, 'America/New_York')).toEqual({ open: '07:00', close: '18:00' });
  });

  it('closed Sunday shows closed', () => {
    const sundayNoon = new Date('2026-10-25T16:00:00Z');
    expect(todayHours({ hours: HOURS }, sundayNoon, 'America/New_York')).toBeNull();
  });

  it('uses the store time zone', () => {
    // 02:00 UTC Monday is still Sunday evening in New York.
    const instant = new Date('2026-10-26T02:00:00Z');
    expect(todayHours({ hours: HOURS }, instant, 'America/New_York')).toBeNull();
    expect(todayHours({ hours: HOURS }, instant, 'UTC')).toEqual({ open: '07:00', close: '18:00' });
  });
});
