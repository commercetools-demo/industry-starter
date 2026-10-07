import { addDays, addMonths, diffDays, parseDateOnly, systemClock, toDateOnly } from './dates';

describe('date-only arithmetic', () => {
  it('addMonths clamps to the month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
  });
  it('addMonths handles leap years', () => {
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });
  it('addMonths adds whole years and crosses year ends', () => {
    expect(addMonths('2026-10-07', 24)).toBe('2028-10-07');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-10-07', 0)).toBe('2026-10-07');
  });
  it('addDays crosses month ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('diffDays counts whole days, b minus a', () => {
    expect(diffDays('2026-10-07', '2026-10-12')).toBe(5);
    expect(diffDays('2026-10-12', '2026-10-07')).toBe(-5);
    expect(diffDays('2026-02-28', '2026-03-01')).toBe(1);
  });
  it('parseDateOnly rejects impossible and malformed dates', () => {
    expect(parseDateOnly('2026-02-30')).toBeNull();
    expect(parseDateOnly('2026-2-3')).toBeNull();
    expect(parseDateOnly('2026-10-07T10:00:00Z')).toBeNull();
    expect(parseDateOnly('2026-10-07')?.toISOString()).toBe('2026-10-07T00:00:00.000Z');
  });
  it('toDateOnly uses UTC', () => {
    expect(toDateOnly(new Date('2026-10-07T23:30:00-05:00'))).toBe('2026-10-08');
  });
  it('systemClock returns a Date', () => {
    expect(systemClock()).toBeInstanceOf(Date);
  });
});
