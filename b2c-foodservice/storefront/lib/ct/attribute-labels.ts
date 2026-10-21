import 'server-only';
import { apiRoot } from '@/lib/ct/client';
import { cachedPublic } from '@/lib/ct/public-cache';
import { mapAttributeLabels, type AttributeLabels } from '@/lib/mappers/attribute-labels';

async function fetchAttributeLabels(locale: string): Promise<AttributeLabels> {
  const { body } = await apiRoot.productTypes().get({ queryArgs: { limit: 100 } }).execute();
  return mapAttributeLabels(body.results, locale);
}

/**
 * Enum labels per attribute (`labels.roast.dark` is "Dark") for a display locale, read from the product types.
 * Public data, cached 3600 s (tag `attribute-labels`). Keys stay the URL values; labels are only for display.
 */
export const getAttributeLabels: (locale: string) => Promise<AttributeLabels> = cachedPublic(
  'attributeLabels',
  ['attribute-labels'],
  fetchAttributeLabels,
);
