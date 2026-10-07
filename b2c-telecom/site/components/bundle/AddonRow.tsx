'use client';

import type { ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Tag } from '@/components/ui/Tag';
import { FOCUS_RING } from '@/components/ui/focus';
import { Link } from '@/i18n/routing';
import { cx } from '@/lib/cx';
import { formatMoneyExact } from '@/lib/format';
import type { CartLine, Locale } from '@/lib/types';

type AddonRowProps = {
  line: CartLine;
  /** Name of the plan this line belongs to ("For {plan}"). */
  planName?: string;
  busy?: boolean;
  onRemove: (lineId: string) => void;
};

/** An add-on, a piece of equipment or a device of the bundle (the design has no separate section: all sit under "Add-ons"). */
export function AddonRow({ line, planName, busy = false, onRemove }: AddonRowProps): ReactElement {
  const t = useTranslations('bundle');
  const locale = useLocale() as Locale;
  const recurring = line.chargeType === 'recurring';
  const stock = line.stock;
  return (
    <li className="flex flex-wrap items-center gap-5 rounded-xl border border-border bg-surface px-6 py-4">
      <div aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-md bg-pink-900 font-display text-xl font-bold text-text-on-pink">
        {line.name.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-40 flex-1">
        <div className="font-display text-lg font-bold">{line.name}</div>
        {line.description ? <div className="text-sm text-text-muted">{line.description}</div> : null}
        {planName ? <div className="text-sm text-text-muted">{t('line.forPlan', { plan: planName })}</div> : null}
        {stock && !stock.inStock ? (
          <Tag tone="danger" className="mt-2">
            {stock.available && stock.available > 0 ? t('stock.few', { count: stock.available }) : t('stock.out')}
          </Tag>
        ) : null}
      </div>
      <div className="font-display text-lg font-bold">
        {line.includedAtNoCharge ? (
          t('line.included')
        ) : recurring ? (
          t('line.perMonth', { amount: formatMoneyExact(line.total, locale) })
        ) : (
          <>
            {formatMoneyExact(line.total, locale)} <Tag tone="neutral">{t('line.oneTime')}</Tag>
          </>
        )}
      </div>
      {line.requiredEquipment && line.parentLineId ? (
        <Link href={`/shop/add-ons?for=${encodeURIComponent(line.parentLineId)}`} className={cx('font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING)}>
          {t('line.change')}
        </Link>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={() => onRemove(line.id)}
        aria-label={t('line.removeAria', { name: line.name })}
        className={cx('rounded-pill bg-transparent p-0 font-display text-sm font-semibold text-text underline underline-offset-4', FOCUS_RING)}
      >
        {t('line.remove')}
      </button>
    </li>
  );
}
