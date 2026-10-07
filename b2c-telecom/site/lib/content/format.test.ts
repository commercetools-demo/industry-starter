import { formatDate } from './format';

describe('formatDate', () => {
  it('formats a long date per locale', () => {
    expect(formatDate('2026-01-01', 'en-US')).toBe('January 1, 2026');
    expect(formatDate('2026-01-01', 'de-DE')).toBe('1. Januar 2026');
  });
  it('does not shift the day with the machine time zone', () => {
    expect(formatDate('2025-12-31', 'en-US')).toBe('December 31, 2025');
  });
});
