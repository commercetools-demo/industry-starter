import { describe, expect, it } from 'vitest';
import { formatPriceInput, parsePriceInput } from './price-input';

describe('parsePriceInput', () => {
  it('accepts dot or comma, one or two decimals, whole numbers', () => {
    expect(parsePriceInput('90')).toEqual({ kind: 'ok', centAmount: 9000 });
    expect(parsePriceInput('90.5')).toEqual({ kind: 'ok', centAmount: 9050 });
    expect(parsePriceInput('90,05')).toEqual({ kind: 'ok', centAmount: 9005 });
    expect(parsePriceInput(' 0.01 ')).toEqual({ kind: 'ok', centAmount: 1 });
  });
  it('0, negative, three decimals and text are invalid; blank is blank', () => {
    for (const bad of ['0', '0,00', '-5', '90.005', 'abc', '1e3', '9 0', '€90']) expect(parsePriceInput(bad)).toEqual({ kind: 'invalid' });
    expect(parsePriceInput('')).toEqual({ kind: 'blank' });
    expect(parsePriceInput('   ')).toEqual({ kind: 'blank' });
  });
  it('formats without grouping so the text parses back', () => {
    expect(formatPriceInput(129000, 'en-US')).toBe('1290.00');
    expect(formatPriceInput(9005, 'de-DE')).toBe('90,05');
    expect(parsePriceInput(formatPriceInput(129005, 'de-DE'))).toEqual({ kind: 'ok', centAmount: 129005 });
  });
});
