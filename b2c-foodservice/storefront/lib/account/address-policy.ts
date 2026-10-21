import type { AppAddress } from '@/lib/types';

/**
 * What happens to the default when the default address is deleted (Q-L-02). The design says the next address becomes
 * the default (`promote`); the address-book template says none remains (`none`). One constant switches it; both are tested.
 */
export const DEFAULT_ADDRESS_AFTER_DELETE: 'promote' | 'none' = 'promote';

/**
 * The address that becomes the default after `deletedId` is removed: the first remaining address in list order, or null when
 * none is left or the policy is `none`.
 */
export function afterDeleteDefault(
  addresses: readonly Pick<AppAddress, 'id'>[],
  deletedId: string,
  policy: 'promote' | 'none' = DEFAULT_ADDRESS_AFTER_DELETE,
): string | null {
  if (policy === 'none') return null;
  return addresses.find((a) => a.id !== deletedId)?.id ?? null;
}
