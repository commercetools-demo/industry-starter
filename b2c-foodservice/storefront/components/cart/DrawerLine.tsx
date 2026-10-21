'use client';

import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import type { CartLine } from '@/lib/types';
import FulfilmentBadge from './FulfilmentBadge';
import LineImage from './LineImage';
import LineNotice from './LineNotice';
import QuantityStepper from './QuantityStepper';
import { focusAfterRemove, useMoney, type CartUi } from './use-cart-ui';

/**
 * One line in the drawer: image, name and engine line total, variant summary, the fulfilment mark, notices, stepper and a
 * Remove link. While this line's request is pending it is dimmed and its controls are `aria-disabled`; its total keeps
 * the previous engine value until the response replaces it (no optimistic totals).
 */
export default function DrawerLine({ line, ui, onNavigate }: { line: CartLine; ui: CartUi; onNavigate: () => void }) {
  const t = useTranslations('cart.line');
  const money = useMoney();
  const pending = ui.mutations.isPending(line.id);

  return (
    <li aria-busy={pending || undefined} className={`flex gap-3.5 border-b border-line py-4 last:border-b-0 ${pending ? 'opacity-60' : ''}`}>
      <Link href={`/p/${encodeURIComponent(line.slug)}/${encodeURIComponent(line.sku)}`} onClick={onNavigate} tabIndex={-1} aria-hidden="true">
        <LineImage url={line.imageUrl} alt="" width={84} height={100} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/p/${encodeURIComponent(line.slug)}/${encodeURIComponent(line.sku)}`}
            onClick={onNavigate}
            className="font-display text-[14.5px] font-semibold text-ink no-underline hover:underline"
          >
            {line.name}
          </Link>
          <span className="shrink-0 text-[14px] font-semibold" data-testid="line-total">
            {money(line.total)}
          </span>
        </div>
        {line.variantSummary ? <p className="m-0 mt-0.5 text-[12.5px] text-ink-3">{line.variantSummary}</p> : null}
        <div className="mt-1.5">
          <FulfilmentBadge line={line} variant="drawer" />
        </div>
        {line.notices.map((n) => (
          <LineNotice key={n.kind} notice={n} line={line} pending={pending} onShip={() => void ui.ship(line)} />
        ))}
        <div className="mt-3 flex items-center justify-between gap-3">
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
    </li>
  );
}
