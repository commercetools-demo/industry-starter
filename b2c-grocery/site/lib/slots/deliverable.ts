const PATTERNS: Record<string, RegExp[]> = {
  US: [/^\d{5}$/, /^\d{5}-\d{4}$/],
  DE: [/^\d{5}$/],
};

/** Postcode shape check for a supported country (no area test). */
export function isValidPostalCode(country: string, postalCode: string): boolean {
  return (PATTERNS[country] ?? []).some((p) => p.test(postalCode.trim()));
}

/** Deliverability stub: valid US/DE postcodes, except those starting with `00` or `99`. */
export function isDeliverable(country: string, postalCode: string): boolean {
  const code = postalCode.trim();
  return isValidPostalCode(country, code) && !code.startsWith('00') && !code.startsWith('99');
}
