// The brand of a store for e-mail previews (W-05): the primary colour from the store's Contentools theme (same sanitiser as the
// storefront adapter, `lib/contentools/theme.ts`; the Malva default theme when the store has none) and the logo URL of the store
// settings. Server only. Failures give the defaults, never an error.
import 'server-only';
import type { Brand } from '@/lib/w-types';
import { cache } from 'react';
import { getStoreTheme, themePrimaryColour } from '@/lib/contentools/theme';
import { getStoreSettings } from '@/lib/ct/seller/store-settings';

export type { Brand };

export const getBrand: (storeKey: string) => Promise<Brand> = cache(async (storeKey: string): Promise<Brand> => {
  const [theme, settings] = await Promise.all([getStoreTheme(storeKey).catch(() => null), getStoreSettings(storeKey).catch(() => null)]);
  const name = settings?.name;
  return {
    primary: themePrimaryColour(theme),
    logoUrl: settings?.logoUrl ?? null,
    storeName: (name && (name['en-US'] ?? Object.values(name)[0])) || storeKey,
  };
});
