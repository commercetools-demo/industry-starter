/**
 * App types: the only shapes components, hooks and context may import.
 * Skeleton only; each workstream adds its own types here. SDK types are never re-exported:
 * lib/mappers/ converts them before they leave lib/ct/.
 */

/** commercetools localized string: locale key -> text. Render with getLocalizedString(field, locale). */
export type LocalizedString = Record<string, string>;

/** Money as the platform sends it. Render with formatMoney(centAmount, currencyCode, locale). */
export interface Money {
  centAmount: number;
  currencyCode: string;
  fractionDigits: number;
}

/** Body of every non-2xx BFF response (see lib/api.ts). */
export interface ApiErrorBody {
  error: string;
}
