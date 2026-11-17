import 'server-only';
import type { ProductProjection } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { getKeyValueDocumentValue } from '@/lib/ct/preset-bundles';
import { modifierConfigIdOf, parseModifierConfig } from '@/lib/mappers/drink-modifiers';
import type { ModifierOption } from '@/lib/types';
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
