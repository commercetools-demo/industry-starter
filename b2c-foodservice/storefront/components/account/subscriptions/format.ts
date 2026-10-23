'use client';

import { useLocale } from 'next-intl';
import { useCallback } from 'react';

/** Date-only values in the page locale, always in UTC so the day does not shift between the server and the browser. */
export function useDateLabel(): (iso: string) => string {
  const locale = useLocale();
  return useCallback((iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso)), [locale]);
}
