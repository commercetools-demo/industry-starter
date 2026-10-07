'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAccount } from '@/hooks/useAccount';
import { PENDING_SAVE_KEY, SAVE_PARAM, useWishlistMutations } from '@/hooks/useSaved';
import { usePathname, useRouter } from '@/i18n/routing';

/**
 * Completes a save that an anonymous heart click started. It acts only when the URL has `?save=<productId>` AND
 * `sessionStorage.pendingSave` holds the same id (written by the click in this browser) AND the shopper is signed in,
 * so a crafted link can never save anything. The product is added once, then the storage entry and the `save`
 * parameter are removed. Renders nothing; mounted once in the locale layout (inside a Suspense boundary).
 */
export function PendingSaveRunner() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { user, data } = useAccount();
  const { save } = useWishlistMutations();
  const handled = useRef<string | null>(null);
  // The sign-in URL carries `save` too (so a registration link can keep it); the destination page completes the save.
  const onAuthPage = pathname.startsWith('/account/sign-in') || pathname.startsWith('/account/register');
  const productId = onAuthPage ? null : searchParams.get(SAVE_PARAM);
  const signedIn = user !== null;
  const known = data !== undefined;

  useEffect(() => {
    // Anonymous (or not yet known): leave everything as it is; the shopper may still be on the way to sign in.
    if (!productId || !known || !signedIn || handled.current === productId) return;
    handled.current = productId;
    const strip = (clearPending: boolean) => {
      if (clearPending) sessionStorage.removeItem(PENDING_SAVE_KEY);
      const rest = new URLSearchParams(searchParams.toString());
      rest.delete(SAVE_PARAM);
      const qs = rest.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`);
    };
    if (sessionStorage.getItem(PENDING_SAVE_KEY) !== productId) {
      strip(false); // not our link: leave a legitimate pending save alone
      return;
    }
    void save(productId)
      .catch(() => undefined) // a failed save is not retried by reloading the same link
      .finally(() => strip(true));
  }, [productId, known, signedIn, save, router, pathname, searchParams]);

  return null;
}
