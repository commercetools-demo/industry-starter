import { describe, expect, it } from 'vitest';
import { formatAgentAmount, fractionDigits, toMinor } from './money';

describe('assistant money', () => {
  it('Amount 349 renders 349.00 in USD', () => {
    expect(formatAgentAmount(349, 'USD', 'en-US')).toBe('$349.00');
  });
  it('Cent exact 4297 renders 42.97 through the same formatter', async () => {
    const { formatMoney } = await import('@/lib/utils');
    expect(formatMoney(4297, 'USD', 'en-US')).toBe('$42.97');
  });
  it('renders CAD for en-CA', () => {
    expect(formatAgentAmount(12.5, 'CAD', 'en-CA')).toMatch(/12\.50/);
  });
  it('rounds to the cent without drift', () => {
    expect(toMinor(4.35, 'USD')).toBe(435);
    expect(toMinor(0.1 + 0.2, 'USD')).toBe(30);
    expect(toMinor(19.99, 'USD')).toBe(1999);
  });
  it('uses the currency fraction digits', () => {
    expect(fractionDigits('USD')).toBe(2);
    expect(fractionDigits('JPY')).toBe(0);
    expect(toMinor(500, 'JPY')).toBe(500);
  });
});
