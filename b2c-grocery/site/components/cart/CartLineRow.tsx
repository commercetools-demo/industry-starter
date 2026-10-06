'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Photo } from '@/components/ui/Photo';
import { QuantityStepper } from '@/components/ui/QuantityStepper';
import { Tag } from '@/components/ui/Tag';
import type { CartLine } from '@/lib/types';
import { formatMoney } from '@/lib/utils';
import { RecurrenceBadge } from './RecurrenceBadge';
import { SubstitutionControl } from './SubstitutionControl';

type CartLineRowProps = {
  line: CartLine;
  /** Quantity to show while a change is in flight (optimistic); falls back to the server quantity. */
  displayQuantity: number;
  busy: boolean;
  onQuantityChange: (line: CartLine, quantity: number) => void;
  onRemove: (line: CartLine) => void;
};

/** One bag line: 150x180 photo, name, line total, stock tag, quantity stepper, ghost Remove. */
export function CartLineRow({ line, displayQuantity, busy, onQuantityChange, onRemove }: CartLineRowProps) {
  const t = useTranslations('cart');
  const locale = useLocale();
  return (
    <li className="flex gap-(--space-4) border-b border-divider py-[17.6px] first:pt-0" data-line-id={line.id}>
      <Photo
        src={line.image ?? ''}
        alt={line.name}
        sizes="150px"
        className="h-[116px] w-[96px] flex-none tablet:h-[180px] tablet:w-[150px]"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-(--space-2)">
        <div className="flex items-start justify-between gap-(--space-3)">
          <h3 className="m-0 text-[22px]">{line.name}</h3>
          <span className="flex-none text-[17px]">{formatMoney(line.total.centAmount, line.total.currencyCode, locale)}</span>
        </div>
        {line.increment.label ? <div className="card-meta">{line.increment.label}</div> : null}
        <div className="flex flex-wrap items-center gap-(--space-2)">
          <Tag tone="neutral">{line.inStock ? t('inStockTag') : t('outOfStockTag')}</Tag>
          <RecurrenceBadge line={line} />
        </div>
        {line.inStock ? null : (
          <p role="alert" className="m-0 text-[13px] text-accent-700">
            {t('lineUnavailable')}
          </p>
        )}
        <SubstitutionControl line={line} />
        <div className="mt-auto flex items-center gap-(--space-3)">
          <QuantityStepper
            value={displayQuantity}
            min={1}
            max={line.availableQuantity !== undefined ? Math.max(line.availableQuantity, 1) : undefined}
            label={t('quantityOf', { name: line.name })}
            decreaseLabel={t('decrease', { name: line.name })}
            increaseLabel={t('increase', { name: line.name })}
            disabled={busy}
            onChange={(quantity) => onQuantityChange(line, quantity)}
          />
          <Button variant="ghost" disabled={busy} onClick={() => onRemove(line)}>
            {t('remove')}
          </Button>
        </div>
      </div>
    </li>
  );
}
