import { CLIENT_KEYS, familyOf } from './cache-keys';

type Mutate = (matcher: (key: unknown) => boolean, data?: undefined, options?: { revalidate: boolean }) => unknown;

/** Sign-out and Business Unit change: drop the account, quote-list and Business Unit entries (and every tuple of them). */
export function clearClientState(mutate: Mutate, keep?: (key: unknown) => boolean): unknown {
  return mutate((key) => CLIENT_KEYS.includes(familyOf(key) as never) && !keep?.(key), undefined, { revalidate: false });
}

/** Business Unit change: clear every entry that belongs to another company, keep this one's. */
export const clearOtherCompanies = (mutate: Mutate, businessUnitKey: string): unknown =>
  mutate((key) => Array.isArray(key) && key.length > 1 && key[1] !== businessUnitKey && CLIENT_KEYS.includes(familyOf(key) as never), undefined, { revalidate: false });
