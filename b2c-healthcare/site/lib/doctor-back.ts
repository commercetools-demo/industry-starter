import { listingHref, parseListingState } from '@/lib/listing-url';
import type { ConsultationMode } from '@/lib/types';

const LIST_PATH = /^\/doctors\/(remote|office)(?:\?([^#]*))?$/;

export const isConsultationMode = (value: unknown): value is ConsultationMode => value === 'remote' || value === 'office';

/**
 * The doctor list the visitor came from. `back` is user-controlled input, so it is never used as is: only a
 * locale-less `/doctors/remote|office` path qualifies, and its query is parsed and re-serialized through the
 * listing state (so only known filters survive). Anything else gives the plain list of `mode`.
 */
export function backToList(raw: string | undefined, mode: ConsultationMode): string {
  const fallback = `/doctors/${mode}`;
  if (typeof raw !== 'string' || raw.length > 400) return fallback;
  const match = LIST_PATH.exec(raw);
  if (!match) return fallback;
  return listingHref(`/doctors/${match[1]}`, parseListingState(new URLSearchParams(match[2] ?? '')));
}

/** The profile link of a card: the mode and, so "← All doctors" restores them, the list URL (locale-less). */
export function doctorHref(key: string, mode: ConsultationMode, from?: string): string {
  const query = new URLSearchParams({ m: mode });
  if (from && from !== `/doctors/${mode}`) query.set('back', from);
  return `/doctor/${key}?${query.toString()}`;
}
