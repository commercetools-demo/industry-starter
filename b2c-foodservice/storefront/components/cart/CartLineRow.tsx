'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useNow } from '@/components/pdp/use-now';
import { Link } from '@/i18n/routing';
import { deliveryEstimate } from '@/lib/product/delivery';
import { DELIVERY_CUTOFF_HOUR, SHIP_DAYS_MAX, SHIP_DAYS_MIN } from '@/lib/shop-config';
import type { CartLine } from '@/lib/types';
import { marketForLocale } from '@/lib/utils';
import FulfilmentBadge from './FulfilmentBadge';
import FulfilmentChips from './FulfilmentChips';
import LineImage from './LineImage';
import LineNotice from './LineNotice';
import QuantityStepper from './QuantityStepper';
import { focusAfterRemove, useIntervalLabel, useMoney, type CartUi } from './use-cart-ui';

/** "First delivery by {day}, then every 2 weeks" for a subscription line (the PDP's delivery rule, Q-I-10). */
function FirstDelivery({ line }: { line: CartLine }) {
  const t = useTranslations('cart.line');
  const locale = useLocale();
  const now = useNow();
  const interval = useIntervalLabel();
  if (!line.recurrence || !now) return null;
  const est = deliveryEstimate(now, {
    cutoffHour: DELIVERY_CUTOFF_HOUR, timeZone: marketForLocale(locale).timeZone, minDays: SHIP_DAYS_MIN, maxDays: SHIP_DAYS_MAX,
  });
  const day = new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(est.latest);
  const label = interval(line.recurrence.schedule);
  return <p className="m-0 mt-1 text-[12.5px] text-ink-3">{t('firstDelivery', { day, interval: label.charAt(0).toLowerCase() + label.slice(1) })}</p>;
}

/**
 * A line on the cart page. It sits inside its fulfilment cluster and carries the fulfilment badge (D-033); the chip pair
 * switches it between Collect and Ship (the server merges it with an identical line when one exists).
 */
export default function CartLineRow({ line, ui }: { line: CartLine; ui: CartUi }) {
  const t = useTranslations('cart.line');
  const money = useMoney();
  const pending = ui.mutations.isPending(line.id);
  const href = `/p/${encodeURIComponent(line.slug)}/${encodeURIComponent(line.sku)}`;

  return (
    <li
      aria-busy={pending || undefined}
      data-line-id={line.id}
      className={`grid gap-4 border-b border-line py-5 last:border-b-0 xs:grid-cols-[96px_minmax(0,1fr)] xs:gap-5 ${pending ? 'opacity-60' : ''}`}
    >
      <Link href={href} tabIndex={-1} aria-hidden="true">
        <LineImage url={line.imageUrl} alt="" width={96} height={116} />
      </Link>
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <Link href={href} className="font-display text-[15.5px] font-semibold text-ink no-underline hover:underline">
            {line.name}
          </Link>
          <span className="shrink-0 text-[15px] font-semibold" data-testid="line-total">
            {money(line.total)}
          </span>
        </div>
        {line.variantSummary ? <p className="m-0 mt-0.5 text-[13px] text-ink-3">{line.variantSummary}</p> : null}
        <p className="m-0 mt-0.5 text-[12.5px] text-ink-3">
          {line.oldUnitPrice ? <s className="mr-1.5">{money(line.oldUnitPrice)}</s> : null}
          {money(line.unitPrice)}
        </p>
        <div className="mt-2">
          <FulfilmentBadge line={line} variant="page" />
        </div>
        {line.fulfilment === 'subscribe' ? <FirstDelivery line={line} /> : null}
        {line.notices.map((n) => (
          <LineNotice key={n.kind} notice={n} line={line} pending={pending} onShip={() => void ui.ship(line)} />
        ))}
        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
          <FulfilmentChips line={line} pending={pending} onCollect={() => void ui.collect(line)} onShip={() => void ui.ship(line)} />
          <div className="flex items-center gap-4">
            <QuantityStepper
              value={line.quantity}
              max={line.maxQuantity}
              name={line.name}
              pending={pending}
              onChange={(q) => void ui.setQuantity(line, q)}
            />
            <button
              type="button"
              data-line-remove
              aria-label={t('removeNamed', { name: line.name })}
              aria-disabled={pending}
              onClick={(e) => {
                if (pending) return;
                const root = e.currentTarget.closest<HTMLElement>('[data-cart-root]');
                const index = root ? Array.from(root.querySelectorAll('[data-line-remove]')).indexOf(e.currentTarget) : 0;
                void ui.remove(line).then(() => focusAfterRemove(root, index));
              }}
              className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-ink-3 underline underline-offset-2 hover:text-ink"
            >
              {t('remove')}
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
