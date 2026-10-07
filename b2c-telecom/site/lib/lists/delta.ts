import type { Money, PriceDelta } from '@/lib/types';

/**
 * What changed between the price a line was saved at and the price now (both are the line's monthly price, else its one-time price,
 * chosen by the caller). A missing price or a currency change is `unknown`: no badge is shown, nothing is guessed.
 */
export function priceDelta(saved: Money | null, current: Money | null): PriceDelta {
  if (!saved || !current || saved.currencyCode !== current.currencyCode) return { status: 'unknown', deltaCents: 0 };
  const deltaCents = current.centAmount - saved.centAmount;
  if (deltaCents === 0) return { status: 'same', deltaCents: 0 };
  return { status: deltaCents > 0 ? 'up' : 'down', deltaCents };
}
