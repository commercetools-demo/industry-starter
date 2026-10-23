'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import { CART_PENDING } from '@/hooks/useCartMutations';
import type { Cart } from '@/lib/types';
import type { CartUi } from './use-cart-ui';

/**
 * Applied code chips: the code in mono, its name when there is one, and a remove button. A code that no longer matches
 * (the line it depended on was removed, it expired) stays visible, muted, with the reason; the totals already exclude it.
 */
export default function AppliedCodes({ cart, ui }: { cart: Cart; ui: CartUi }) {
  const t = useTranslations('cart.code');
  if (cart.codes.length === 0) return null;
  return (
    <ul aria-label={t('applied')} className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
      {cart.codes.map((c) => {
        const active = c.state === 'MatchesCart';
        return (
          <li
            key={c.id}
            data-state={c.state}
            className={`flex items-center gap-2 rounded-pill border px-3 py-1.5 text-[12.5px] ${active ? 'border-teal-strong bg-surface text-teal-text' : 'border-line-2 bg-canvas-2 text-ink-3'}`}
          >
            <span className="font-mono font-medium">{c.code}</span>
            {c.name ? <span>{c.name}</span> : null}
            {c.reasonKey ? <span role="status">{t(c.reasonKey.replace('code.', '') as 'reason.NotActive')}</span> : null}
            <button
              type="button"
              aria-label={t('remove', { code: c.code })}
              aria-disabled={ui.mutations.isPending(CART_PENDING)}
              onClick={() => {
                if (!ui.mutations.isPending(CART_PENDING)) void ui.mutations.removeCode(c.id).catch(ui.report);
              }}
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-pill border-0 bg-transparent p-0 text-current"
            >
              <Icon name="x" size={12} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
