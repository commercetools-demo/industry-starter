'use client';

import { useTranslations } from 'next-intl';
import { storeName } from '@/components/cart/use-cart-ui';
import Icon from '@/components/ui/Icon';
import { Link } from '@/i18n/routing';
import type { Cart, CheckoutIssue } from '@/lib/types';

/** What is wrong with the bag, line by line, with the way out (the bag). `price_changed` is a notice and does not block Continue. */
export default function CheckoutIssues({ issues, cart }: { issues: readonly CheckoutIssue[]; cart: Cart }) {
  const t = useTranslations('checkout.issues');
  if (issues.length === 0) return null;
  const blocking = issues.some((i) => i.code !== 'price_changed');

  const text = (i: CheckoutIssue): string => {
    const line = cart.lines.find((l) => l.id === i.lineId);
    const name = line?.name ?? '';
    switch (i.code) {
      case 'line_unavailable':
        return t('unavailable', { name });
      case 'collect_out_of_stock':
        return t('collectOut', { name, store: line ? storeName(line) : '' });
      case 'collect_not_available':
        return t('collectNotAvailable', { name });
      case 'currency_mismatch':
        return t('currencyMismatch', { name });
      default:
        return t('priceChanged', { name });
    }
  };

  return (
    <div role={blocking ? 'alert' : 'status'} data-testid="checkout-issues" className="mb-5 rounded-card border border-line-2 bg-canvas-2 p-4">
      <p className="m-0 flex items-center gap-2 text-[14px] font-semibold text-ink">
        <Icon name="shield" size={16} />
        {t('review')}
      </p>
      <ul className="m-0 mt-2 list-none p-0">
        {issues.map((i) => (
          <li key={`${i.code}-${i.lineId}`} className="py-0.5 text-[13.5px] text-ink-2">
            {text(i)}
          </li>
        ))}
      </ul>
      {blocking ? (
        <Link href="/cart" className="mt-2 inline-block text-[13.5px] font-medium text-ink underline underline-offset-2">
          {t('toCart')}
        </Link>
      ) : null}
    </div>
  );
}
