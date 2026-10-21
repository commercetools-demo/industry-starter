'use client';

import { useTranslations } from 'next-intl';
import Icon from '@/components/ui/Icon';
import type { CartLine, LineNotice as Notice } from '@/lib/types';
import { storeName } from './use-cart-ui';

/**
 * One notice under a line's fulfilment text, as a `role="status"` region: "Price updated" (neutral), stock problems (amber).
 * A collect line that is not in stock at its store offers a Ship button (spec "Switch to ship").
 */
export default function LineNotice({
  notice, line, onShip, pending,
}: {
  notice: Notice;
  line: Pick<CartLine, 'store'>;
  onShip: () => void;
  pending: boolean;
}) {
  const t = useTranslations('cart.notice');
  const stock = notice.kind !== 'price-updated';
  return (
    <p
      role="status"
      data-notice={notice.kind}
      className={`m-0 mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] ${stock ? 'rounded-field bg-amber/25 px-2.5 py-1.5 text-ink' : 'text-ink-2'}`}
    >
      {stock ? <Icon name="clock" size={13} /> : null}
      <span>
        {notice.kind === 'price-updated' ? t('priceUpdated') : null}
        {notice.kind === 'out-of-stock' ? t('outOfStock') : null}
        {notice.kind === 'collect-unavailable' ? t('collectUnavailable', { store: storeName(line) }) : null}
        {notice.kind === 'quantity-exceeds-stock' ? t('quantityLimit', { n: notice.available ?? 0 }) : null}
      </span>
      {notice.kind === 'collect-unavailable' ? (
        <button
          type="button"
          onClick={() => {
            if (!pending) onShip();
          }}
          aria-disabled={pending}
          className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-ink underline underline-offset-2"
        >
          {t('tryShipping')}
        </button>
      ) : null}
    </p>
  );
}
