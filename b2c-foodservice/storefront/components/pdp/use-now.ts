'use client';

import { useMemo, useSyncExternalStore } from 'react';

const MINUTE = 60_000;

/**
 * The current time, available after hydration (null on the server and during hydration, so time-dependent text never
 * causes a hydration mismatch). The value is rounded down to the minute and refreshes every minute.
 */
export function useNow(): Date | null {
  const stamp = useSyncExternalStore(
    (onChange) => {
      const timer = window.setInterval(onChange, MINUTE);
      return () => window.clearInterval(timer);
    },
    () => Math.floor(Date.now() / MINUTE) * MINUTE,
    () => null,
  );
  return useMemo(() => (stamp === null ? null : new Date(stamp)), [stamp]);
}
