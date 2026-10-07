import type { Market } from '@/lib/utils';

export type SwitchCartLine = { offerKey: string; name: string };
export type SwitchCart = { currency: string; country: string; lines: SwitchCartLine[] };
export type SwitchPlan = { market: Market; cart: { action: 'none' | 'discarded'; droppedLines: SwitchCartLine[] } };

/**
 * A cart's currency is fixed at creation and price selection depends on currency and country, so a cart priced for another
 * market is discarded (never re-priced or partially carried over) and every line it held is reported to the buyer.
 */
export function planMarketSwitch(to: Market, cart: SwitchCart | null): SwitchPlan {
  const mismatch = cart !== null && cart.lines.length > 0 && (cart.currency !== to.currency || cart.country !== to.country);
  return {
    market: to,
    cart: mismatch ? { action: 'discarded', droppedLines: cart.lines.map((line) => ({ ...line })) } : { action: 'none', droppedLines: [] },
  };
}
