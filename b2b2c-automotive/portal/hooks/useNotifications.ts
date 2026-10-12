'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import { dismissNotification, readDismissed, unreadItems } from '@/lib/portal/notifications';
import type { PortalNotification } from '@/lib/portal/types';
import { swrFetcher } from './http';

const storage = () => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** Notifications of the signed-in associate with per-customer dismissals kept in the browser (Q-R04). */
export function useNotifications(customerId: string, businessUnitKey: string) {
  const { data } = useSWR<{ notifications: PortalNotification[] }>(['notifications', businessUnitKey], () => swrFetcher<{ notifications: PortalNotification[] }>('/api/notifications'), {
    revalidateOnFocus: true,
  });
  const [tick, setTick] = useState(0);
  // The list only exists after the fetch, so reading storage during render never disagrees with the server markup.
  const dismissed = useMemo(() => readDismissed(storage(), customerId), [customerId, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => unreadItems(data?.notifications ?? [], dismissed), [data, dismissed]);
  const dismiss = useCallback(
    (id: string) => {
      dismissNotification(storage(), customerId, id);
      setTick((t) => t + 1);
    },
    [customerId],
  );
  return { items, count: items.length, dismiss };
}
