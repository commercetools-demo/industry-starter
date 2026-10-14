// sortOrder bands for discounts (decision 14). A HIGHER value is applied first (commercetools docs, "How Cart Discounts work";
// confirmed against the knowledge MCP in T-00). Portal rank 1 = highest sortOrder. If a live check ever shows the opposite
// direction, flip SORT_HIGHER_FIRST: the bands mirror and `rankToSortOrders` reverses.
// commercetools requires sortOrder to be unique per kind across the project, a decimal string in (0, 1) not ending in 0.
export const SORT_HIGHER_FIRST = true;

export type DiscountKind = 'product' | 'cart';
export type Band = 'reseller' | 'malva-funded';

/** Bands as [low, high] decimals for the "higher first" direction. Mirrored (1 - x) otherwise. */
export const BANDS: Record<Band, readonly [number, number]> = {
  reseller: [0.05, 0.89],
  'malva-funded': [0.9, 0.99],
};

const DIGITS = 10;

function format(n: number): string {
  // 10 fraction digits, last digit forced to 1..9 (never 0).
  let digits = Math.round(n * 10 ** DIGITS)
    .toString()
    .padStart(DIGITS, '0');
  if (digits.endsWith('0')) digits = digits.slice(0, -1) + '5';
  return `0.${digits}`;
}

/** A random unused sortOrder inside the band; `held` is every value of the kind in the project (seeded ones included). */
export function allocateSortOrder(
  kind: DiscountKind,
  held: ReadonlySet<string>,
  band: Band,
  options: { higherFirst?: boolean; random?: () => number } = {},
): string {
  void kind; // values are unique per kind; the caller passes the kind's values in `held`
  const higherFirst = options.higherFirst ?? SORT_HIGHER_FIRST;
  const random = options.random ?? Math.random;
  const [low, high] = higherFirst ? BANDS[band] : [1 - BANDS[band][1], 1 - BANDS[band][0]];
  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const value = format(low + random() * (high - low));
    if (!held.has(value) && Number(value) >= low && Number(value) <= high) return value;
  }
  throw new Error('No free sortOrder in the band');
}

const compareDigits = (a: string, b: string): number => {
  const x = a.replace('0.', '').padEnd(DIGITS + 4, '0');
  const y = b.replace('0.', '').padEnd(DIGITS + 4, '0');
  return x < y ? -1 : x > y ? 1 : 0;
};

/**
 * The store's own values, permuted: `orderedIds[0]` (rank 1) gets the value that fires first, and so on.
 * `currentValues` holds the sortOrder of every id in `orderedIds`.
 */
export function rankToSortOrders(
  orderedIds: readonly string[],
  currentValues: ReadonlyMap<string, string>,
  options: { higherFirst?: boolean } = {},
): Map<string, string> {
  const higherFirst = options.higherFirst ?? SORT_HIGHER_FIRST;
  const values = orderedIds.map((id) => {
    const value = currentValues.get(id);
    if (value === undefined) throw new Error(`No sortOrder known for ${id}`);
    return value;
  });
  values.sort((a, b) => (higherFirst ? compareDigits(b, a) : compareDigits(a, b)));
  return new Map(orderedIds.map((id, index) => [id, values[index] as string]));
}

/** True when `value` is inside the band (for the check script and tests). */
export function inBand(value: string, band: Band, higherFirst: boolean = SORT_HIGHER_FIRST): boolean {
  const [low, high] = higherFirst ? BANDS[band] : [1 - BANDS[band][1], 1 - BANDS[band][0]];
  const n = Number(value);
  return n >= low - 1e-9 && n <= high + 1e-9;
}
