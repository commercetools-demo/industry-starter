import type { CardBadge } from '@/lib/types';

/** Fixed precedence when several flags apply (Q-G-03): Bestseller, Limited edition, New, Subscribe & save. */
export function pickBadge(flags: { badge?: string; subscribable?: boolean }): CardBadge | null {
  if (flags.badge === 'bestseller') return 'bestseller';
  if (flags.badge === 'limited-edition') return 'limited-edition';
  if (flags.badge === 'new') return 'new';
  return flags.subscribable ? 'subscribe' : null;
}
