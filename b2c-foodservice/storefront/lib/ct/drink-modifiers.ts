import 'server-only';
import type { ProductProjection } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { getKeyValueDocumentValue } from '@/lib/ct/preset-bundles';
import { modifierConfigIdOf, parseFlavorCategoryId, parseModifierConfig } from '@/lib/mappers/drink-modifiers';
import type { FlavorOption, ModifierOption } from '@/lib/types';
import { getLocalizedString } from '@/lib/utils';

/**
 * Ready-made coffee modifiers on the server (see lib/mappers/drink-modifiers.ts for the data model). The configuration read is
 * the cached key-value document read of the preset bundles (60 s); names are read uncached (one call for every id).
 */

/** The modifier product ids a drink offers, in the configuration's order. Empty when the drink has no configuration. */
export async function getAllowedModifierIds(projection: Pick<ProductProjection, 'masterVariant'>): Promise<string[]> {
  const configId = modifierConfigIdOf(projection.masterVariant?.attributes);
  if (!configId) return [];
  return parseModifierConfig(await getKeyValueDocumentValue(configId)) ?? [];
}

/** Product names by id (published products only; an id that is not found is left out). */
export async function getModifierNames(ids: readonly string[], locale: string): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { body } = await apiRoot
    .productProjections()
    .get({ queryArgs: { staged: false, where: `id in (${ids.map((id) => `"${id}"`).join(', ')})`, limit: Math.min(ids.length, 100) } })
    .execute();
  // No locale projection: a name missing in this locale falls back to another one.
  return Object.fromEntries(body.results.map((p) => [p.id, getLocalizedString(p.name, locale)] as const).filter(([, n]) => n !== ''));
}

/** The modifiers the product page offers, in the configuration's order. */
export async function getModifierOptions(projection: Pick<ProductProjection, 'masterVariant'>, locale: string): Promise<ModifierOption[]> {
  const ids = await getAllowedModifierIds(projection);
  const names = await getModifierNames(ids, locale);
  return ids.flatMap((id) => (names[id] ? [{ id, name: names[id] }] : []));
}

/** The pod products of a drink's flavor category (published, one read), with the owner's order: roast intensity high to low, then name. */
async function readFlavorProducts(categoryId: string, locale: string): Promise<FlavorOption[]> {
  const { body } = await apiRoot
    .productProjections()
    .get({ queryArgs: { staged: false, where: `categories(id="${categoryId}")`, limit: 50 } })
    .execute();
  const intensity = (p: ProductProjection) => {
    const v = p.masterVariant.attributes?.find((a) => a.name === 'intensity')?.value;
    return typeof v === 'number' ? v : -1;
  };
  return [...body.results]
    .sort((a, b) => intensity(b) - intensity(a) || getLocalizedString(a.name, locale).localeCompare(getLocalizedString(b.name, locale)))
    .flatMap((p) => {
      const name = getLocalizedString(p.name, locale);
      const level = intensity(p);
      return name ? [{ id: p.id, name, description: p.description ? getLocalizedString(p.description, locale) : '', ...(level >= 0 ? { intensity: level } : {}) }] : [];
    });
}

/** The flavor category id of a drink's configuration, or null when it names none. */
async function flavorCategoryIdOf(projection: Pick<ProductProjection, 'masterVariant'>): Promise<string | null> {
  const configId = modifierConfigIdOf(projection.masterVariant?.attributes);
  return configId ? parseFlavorCategoryId(await getKeyValueDocumentValue(configId)) : null;
}

/** The pod flavors a drink offers (the products of its configuration's flavor category). Empty when the configuration names none. */
export async function getFlavorOptions(projection: Pick<ProductProjection, 'masterVariant'>, locale: string): Promise<FlavorOption[]> {
  const categoryId = await flavorCategoryIdOf(projection);
  return categoryId ? readFlavorProducts(categoryId, locale) : [];
}

/** Every product id the cart accepts on a drink line: its modifiers and its flavors, with the flavors apart (a line takes at most one). */
export async function getDrinkChoiceIds(projection: Pick<ProductProjection, 'masterVariant'>): Promise<{ allowed: string[]; flavorIds: string[] }> {
  const [modifierIds, flavors] = await Promise.all([getAllowedModifierIds(projection), getFlavorOptions(projection, 'en-US')]);
  const flavorIds = flavors.map((f) => f.id);
  return { allowed: [...modifierIds, ...flavorIds.filter((id) => !modifierIds.includes(id))], flavorIds };
}
