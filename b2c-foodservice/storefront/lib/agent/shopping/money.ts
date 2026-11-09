/**
 * INBOUND money: the only module that converts the Shopper MCP's integer MINOR units into the agent domain's float in MAJOR units.
 * (The outbound module is `components/assistant/money.ts`, which formats for the shopper with the app's locale and currency.)
 *
 * Two conventions meet here and both are `number`: handing one to the other renders $3.49 for a $349 sofa with no error. Honour the
 * currency's own fraction digits instead of dividing by 100: zero-decimal (JPY) and three-decimal (BHD) currencies read as a pricing bug
 * rather than a units bug the first time one is added. Upstream's `formatMoney` is not copied anywhere in this tree.
 */

const digitsCache = new Map<string, number>();

export function fractionDigits(currency: string): number {
  let digits = digitsCache.get(currency);
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2;
    } catch {
      digits = 2;
    }
    digitsCache.set(currency, digits);
  }
  return digits;
}

/** `34900` USD to `349`. */
export function minorToMajor(amountMinor: number, currency: string): number {
  return amountMinor / 10 ** fractionDigits(currency);
}

/**
 * A line's EFFECTIVE unit price in major units: `lineTotal / quantity` computed in minor units, then scaled. Only then does the agent's
 * derived `lineTotal = price × quantity` reproduce the platform's own line total (using the catalogue unit price makes every line wrong by
 * the per-line discount). Deriving it the other way rounds the total to major units before splitting it. Zero quantity yields 0, not a NaN
 * that would travel silently into a fenced payload.
 */
export function unitPriceMajor(lineTotalMinor: number, quantity: number, currency: string): number {
  if (!Number.isFinite(quantity) || quantity <= 0) return 0;
  return minorToMajor(lineTotalMinor / quantity, currency);
}
