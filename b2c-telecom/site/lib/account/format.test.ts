import { formatDate, formatDateTime } from './format';

describe('account date formatting', () => {
  it('formats a date-only value without a time zone shift', () => {
    expect(formatDate('2026-03-12', 'en-US')).toBe('Mar 12, 2026');
    expect(formatDate('2026-03-12', 'de-DE')).toBe('12.03.2026');
  });
  it('formats a timestamp in UTC', () => {
    expect(formatDate('2026-11-07T23:30:00.000Z', 'en-US')).toBe('Nov 7, 2026');
    expect(formatDateTime('2026-03-07T10:05:00.000Z', 'en-US')).toContain('Mar 7, 2026');
  });
  it('returns text that is not a date unchanged', () => {
    expect(formatDate('soon', 'en-US')).toBe('soon');
  });
});
