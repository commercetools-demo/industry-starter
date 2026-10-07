import type { SavedAddress } from '@/lib/types';

/** The address a new order starts with: the default service address, else none (never the first or only address). U imports this. */
export function pickPreselected(addresses: SavedAddress[]): SavedAddress | null {
  return addresses.find((address) => address.isDefaultService) ?? null;
}
