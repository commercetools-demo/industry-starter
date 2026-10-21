'use client';

import { useEffect, useRef } from 'react';
import { useCollectionStore } from '@/hooks/useCollectionStore';
import { useRouter } from '@/i18n/routing';

/**
 * Cards and counts are rendered on the server for the store in the session. When the shopper picks another store in the
 * picker (client only), this refreshes the route so the availability lines and the "Available at" toggle follow.
 */
export default function ListingStoreSync({ serverStoreKey }: { serverStoreKey: string | null }) {
  const { store, isLoading } = useCollectionStore();
  const router = useRouter();
  const handled = useRef(serverStoreKey);
  const current = store?.key ?? null;
  useEffect(() => {
    if (isLoading || current === handled.current) return;
    handled.current = current;
    router.refresh();
  }, [current, isLoading, router]);
  return null;
}
