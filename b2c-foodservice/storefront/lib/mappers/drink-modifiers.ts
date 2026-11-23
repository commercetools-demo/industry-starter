/**
 * Ready-made coffee modifiers (milks, coffees). Pure helpers shared by the product page, the cart core and checkout.
 *
 * Data model (owner, 2026-11-17):
 *  - a drink (product type `mcf-ready-drink`) has the SameForAll attribute `modifiers`, a reference to a key-value document
 *    made by the configurable-bundles app (container `configurable-bundles_items`);
 *  - the document's `value.bundleConfiguration.possibleModifiers` is a set of product references (type `coffee-modifiers`);
 *  - the same document may carry `bundleConfiguration.flavor`, a reference to a category whose products are the coffee pods the
 *    drink can be made with (owner, 2026-11-23). The shopper picks at most one; it is stored on the line like a modifier (the
 *    `modifiers` field is a set of product references), so no line field is added;
 *  - the drink line is added at the drink's own price with the line type `instore-lineitem-type`; the chosen modifiers are its
 *    custom field `modifiers` (Set of Reference product) and the fulfilment is its field `fulfillment` (US spelling).
 */

/** The drink attribute that references the modifiers configuration. */
export const MODIFIERS_ATTRIBUTE = 'modifiers';

/** The line custom type of a ready-made coffee line, and its two fields the storefront writes. */
export const INSTORE_LINE_TYPE_KEY = 'instore-lineitem-type';
export const INSTORE_FULFILMENT_FIELD = 'fulfillment';
export const INSTORE_MODIFIERS_FIELD = 'modifiers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The product ids a configuration offers, in its order, without duplicates; null when the value is not a modifiers configuration. */
export function parseModifierConfig(value: unknown): string[] | null {
  if (!isRecord(value) || !isRecord(value.bundleConfiguration)) return null;
  const raw = value.bundleConfiguration.possibleModifiers;
  if (!Array.isArray(raw)) return null;
  const ids: string[] = [];
  for (const ref of raw) {
    if (isRecord(ref) && (ref.typeId === undefined || ref.typeId === 'product') && isUuid(ref.id) && !ids.includes(ref.id)) ids.push(ref.id);
  }
  return ids;
}

/** The id of the pod-flavor category a configuration names (`bundleConfiguration.flavor`), or null. */
export function parseFlavorCategoryId(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.bundleConfiguration)) return null;
  const ref = value.bundleConfiguration.flavor;
  return isRecord(ref) && (ref.typeId === undefined || ref.typeId === 'category') && isUuid(ref.id) ? ref.id : null;
}

/** The configuration id on a drink's attributes (master variant; the attribute is SameForAll), or null. */
export function modifierConfigIdOf(attributes: { name: string; value?: unknown }[] | undefined): string | null {
  const value = attributes?.find((a) => a.name === MODIFIERS_ATTRIBUTE)?.value;
  return isRecord(value) && isUuid(value.id) ? value.id : null;
}

/**
 * The shopper's choice checked against the drink's configuration: every id must be offered, and at most one of them a pod flavor
 * (`flavorIds`, which `allowed` includes). Duplicates are dropped and the ids are sorted, so the same set in another order is
 * the same line (commercetools merges lines with equal custom fields). Returns null when an id is not offered or two flavors are chosen.
 */
export function normaliseModifierChoice(chosen: readonly string[], allowed: readonly string[], flavorIds: readonly string[] = []): string[] | null {
  const set = [...new Set(chosen)];
  if (!set.every((id) => allowed.includes(id))) return null;
  if (set.filter((id) => flavorIds.includes(id)).length > 1) return null;
  return set.sort();
}

type LineCustom = { custom?: { fields?: Record<string, unknown> } };

/**
 * The modifier ids of a ready-made coffee line, sorted; undefined for any other line. A line is a ready-made coffee line when
 * it carries the in-store `fulfillment` field (written on every such line, with or without modifiers).
 */
export function lineModifierIds(l: LineCustom): string[] | undefined {
  const fields = l.custom?.fields;
  if (!fields || typeof fields[INSTORE_FULFILMENT_FIELD] !== 'string') return undefined;
  const raw = fields[INSTORE_MODIFIERS_FIELD];
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r) => (isRecord(r) && typeof r.id === 'string' ? [r.id] : [])).sort();
}

/** The name of the fulfilment custom field on a line: the in-store type spells it the US way. */
export function fulfilmentFieldOf(l: LineCustom): 'fulfilment' | 'fulfillment' {
  return lineModifierIds(l) === undefined ? 'fulfilment' : INSTORE_FULFILMENT_FIELD;
}

/** A stable identity of a line's modifiers ('' for none and for other lines), for twin and clone matching. */
export function modifiersKeyOf(l: LineCustom): string {
  return (lineModifierIds(l) ?? []).join(',');
}

/** The custom part of an `addLineItem` for a ready-made coffee line. */
export function instoreLineCustom(fulfilment: string, modifierIds: readonly string[]) {
  return {
    type: { typeId: 'type' as const, key: INSTORE_LINE_TYPE_KEY },
    fields: {
      [INSTORE_FULFILMENT_FIELD]: fulfilment,
      ...(modifierIds.length > 0 ? { [INSTORE_MODIFIERS_FIELD]: modifierIds.map((id) => ({ typeId: 'product' as const, id })) } : {}),
    },
  };
}
