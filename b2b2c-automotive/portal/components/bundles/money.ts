// Money display of the Bundles and Product import screens: EUR cents formatted for the locale.
export function formatEur(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}
