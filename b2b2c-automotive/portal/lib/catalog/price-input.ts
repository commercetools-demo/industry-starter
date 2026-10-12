// What a reseller types into a price field. A comma or a dot is the decimal mark, at most two decimals, above zero.
// Blank means "no override" (the Malva list price applies). Pure.
export type PriceInput = { kind: 'blank' } | { kind: 'ok'; centAmount: number } | { kind: 'invalid' };

export function parsePriceInput(text: string): PriceInput {
  const value = text.trim();
  if (value === '') return { kind: 'blank' };
  if (!/^\d+([.,]\d{1,2})?$/.test(value)) return { kind: 'invalid' };
  const [whole, fraction = ''] = value.replace(',', '.').split('.');
  const centAmount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return centAmount > 0 && Number.isSafeInteger(centAmount) ? { kind: 'ok', centAmount } : { kind: 'invalid' };
}

/** "90,00" or "90.00" for an input, without grouping so the text parses back. */
export function formatPriceInput(centAmount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(centAmount / 100);
}
