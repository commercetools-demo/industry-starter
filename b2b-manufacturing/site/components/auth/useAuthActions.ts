'use client';
import { useSWRConfig } from 'swr';
import { clearClientState } from '@/lib/client-state';
import { KEY_ACCOUNT } from '@/lib/cache-keys';

/** After sign-in or registration every per-visitor entry is refetched; after sign-out they are all cleared. */
export function useAuthActions() {
  const { mutate } = useSWRConfig();
  return {
    refreshAll: () => mutate((key) => typeof key === 'string' || Array.isArray(key)),
    signedIn: () => mutate(KEY_ACCOUNT),
    async signOut() {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
      await clearClientState(mutate as never);
    },
  };
}
