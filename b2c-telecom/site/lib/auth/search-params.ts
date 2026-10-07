// Pure. Reads the query of an auth page on the server (pages avoid `useSearchParams`, so they need no Suspense boundary).
import type { Locale } from '@/lib/types';
import { safeReturnPath } from './return-target';

export type RawSearchParams = Record<string, string | string[] | undefined>;

export const firstParam = (value: string | string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : value);

/**
 * The validated return target of an auth page: `?returnTo=` (or the older `?next=` that `requireSession` writes). `undefined` when
 * the page was opened without one; an unsafe value becomes `/<locale>/account`.
 */
export function returnTargetOf(params: RawSearchParams, locale: Locale): string | undefined {
  const raw = firstParam(params.returnTo) ?? firstParam(params.next);
  return raw === undefined ? undefined : safeReturnPath(raw, locale);
}
