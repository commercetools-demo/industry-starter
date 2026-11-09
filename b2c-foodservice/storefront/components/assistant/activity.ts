'use client';

import { useTranslations } from 'next-intl';
import { useCallback } from 'react';

/** Tools that have their own activity line. Listed explicitly so the key-scrape test knows the computed `activity.<tool>` keys. */
export const ACTIVITY_TOOLS = [
  'search_products',
  'get_product_details',
  'get_orders',
  'get_order_status',
  'get_cart',
  'add_to_cart',
  'update_cart_item',
  'remove_from_cart',
  'checkout',
  'get_preferences',
  'load_skill',
] as const;
const QUERY_TOOLS = new Set<string>(['search_products']);
const KNOWN = new Set<string>(ACTIVITY_TOOLS);

/** The translated line for a call in flight (injected into the turn state machine, which holds no copy). */
export function useDescribeToolCall(): (tool: string, input: Record<string, unknown>) => string {
  const t = useTranslations('assistant');
  return useCallback(
    (tool, input) => {
      if (tool.startsWith('present_')) return t('activity.compose');
      if (!KNOWN.has(tool)) return t('activity.generic');
      const base = t(`activity.${tool}` as 'activity.generic');
      const query = typeof input.query === 'string' ? input.query.trim().slice(0, 60) : '';
      return query && QUERY_TOOLS.has(tool) ? `${base.replace(/…$/, '')} · “${query}”` : base;
    },
    [t],
  );
}
