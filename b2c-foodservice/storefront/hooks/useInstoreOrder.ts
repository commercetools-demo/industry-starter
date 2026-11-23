'use client';

import { useCallback, useState } from 'react';
import { useSWRConfig } from 'swr';
import { fetchJson } from '@/hooks/fetcher';
import type { InstoreOrderForm } from '@/lib/checkout/instore-form';
import { KEY_CART, KEY_CART_COUNT } from '@/lib/cache-keys';

/** Places the In-store order without payment (D-062): `POST /api/checkout/free`. Resolves to the order id and empties the bag in the caches. */
export function useInstoreOrder() {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = useState(false);
  const place = useCallback(
    async (form: InstoreOrderForm): Promise<string> => {
      setBusy(true);
      try {
        const res = await fetchJson<{ orderId: string }>('/api/checkout/free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        await Promise.all([mutate(KEY_CART, { cart: null }, { revalidate: false }), mutate(KEY_CART_COUNT, { count: 0 }, { revalidate: false })]);
        return res.orderId;
      } finally {
        setBusy(false);
      }
    },
    [mutate],
  );
  return { place, busy };
}
