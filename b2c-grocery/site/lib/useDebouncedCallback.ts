'use client';
import { useCallback, useEffect, useRef } from 'react';

/**
 * Returns `[debounced, cancel]`: a stable function that calls `callback` once, `delayMs` after the last call (the latest arguments win).
 * `cancel` drops a pending call; a pending call is also dropped on unmount. The latest `callback` is always used.
 */
export function useDebouncedCallback<Args extends unknown[]>(callback: (...args: Args) => void, delayMs: number) {
  const latest = useRef(callback);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    latest.current = callback;
  });

  const cancel = useCallback(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
  }, []);

  useEffect(() => cancel, [cancel]);

  const debounced = useCallback(
    (...args: Args) => {
      cancel();
      timer.current = setTimeout(() => {
        timer.current = undefined;
        latest.current(...args);
      }, delayMs);
    },
    [cancel, delayMs],
  );

  return [debounced, cancel] as const;
}
