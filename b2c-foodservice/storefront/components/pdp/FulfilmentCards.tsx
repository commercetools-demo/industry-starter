'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useId, useRef, type KeyboardEvent } from 'react';
import { usePdp } from '@/components/pdp/pdp-state';
import Icon, { type IconName } from '@/components/ui/Icon';
import { cn } from '@/lib/cn';
import type { Fulfilment } from '@/lib/product/add-state';
import { formatInterval } from '@/lib/product/interval';
import { savingPercent } from '@/lib/product/price';
import { SHIP_DAYS_MAX, SHIP_DAYS_MIN } from '@/lib/shop-config';
import { formatMoney } from '@/lib/utils';

interface Card { id: Fulfilment; icon: IconName; title: string; line: string; badge?: string; disabled: boolean }

/**
 * "How would you like it?" (workstream H, 3.8): Collect, Delivery and, where a recurring price exists, Subscribe and save.
 * Collect is not rendered in a market without collection (Canada, D-035). Subscribe is never rendered for machines or
 * products without a recurring price for the selected variant. A variant with no price disables Collect and Subscribe.
 */
export default function FulfilmentCards() {
  const t = useTranslations('pdp');
  const locale = useLocale();
  const { data, preview, fulfilment, setFulfilment, store, collectionEnabled, subscribeAvailable, policies, policyId } = usePdp();
  const titleId = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const noPrice = preview.price === null;

  const cards: Card[] = [];
  if (collectionEnabled) {
    cards.push({
      id: 'collect', icon: 'store', title: t('fulfil.collect.title'), disabled: noPrice,
      line: store ? t('fulfil.collect.line', { n: store.collectionMinutes }) : t('fulfil.collect.choose'),
    });
  }
  const threshold = data.freeShippingThreshold;
  cards.push({
    id: 'delivery', icon: 'truck', title: t('fulfil.ship.title'), disabled: false,
    line: threshold
      ? t('fulfil.ship.line', { threshold: formatMoney(threshold.centAmount, threshold.currencyCode, locale), min: SHIP_DAYS_MIN, max: SHIP_DAYS_MAX })
      : t('fulfil.ship.lineFlat', { min: SHIP_DAYS_MIN, max: SHIP_DAYS_MAX }),
  });
  if (subscribeAvailable) {
    const chosen = policies.find((p) => p.policy.id === policyId) ?? policies[0];
    const oneTime = preview.price ? (preview.price.discounted ?? preview.price.value) : undefined;
    const best = oneTime
      ? Math.max(0, ...policies.map((p) => savingPercent(oneTime, p.price.value) ?? 0))
      : 0;
    cards.push({
      id: 'subscribe', icon: 'repeat', title: t('fulfil.subscribe.title'), disabled: noPrice,
      line: t('fulfil.subscribe.line', { interval: chosen ? formatInterval(chosen.policy.schedule, t) : '' }),
      ...(best > 0 ? { badge: t('fulfil.subscribe.saving', { percent: best }) } : {}),
    });
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const enabled = cards.filter((c) => !c.disabled);
    const at = enabled.findIndex((c) => c.id === fulfilment);
    if (at < 0) return;
    e.preventDefault();
    const next = enabled[(at + (e.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length];
    if (next) {
      setFulfilment(next.id);
      refs.current[next.id]?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <p id={titleId} className="m-0 text-[13px] font-semibold text-ink">{t('fulfil.title')}</p>
      <div
        role="radiogroup"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className={cn('grid gap-2.5', cards.length === 3 ? 'grid-cols-1 xs:grid-cols-3' : 'grid-cols-2')}
      >
        {cards.map((c) => {
          const checked = c.id === fulfilment;
          return (
            <button
              key={c.id}
              ref={(el) => {
                refs.current[c.id] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-disabled={c.disabled ? 'true' : undefined}
              tabIndex={checked ? 0 : -1}
              data-fulfilment={c.id}
              onClick={() => {
                if (!c.disabled) setFulfilment(c.id);
              }}
              className={cn(
                'transition-state flex flex-col items-start gap-1.5 rounded-card border bg-surface p-3.5 text-left',
                checked ? 'border-accent shadow-[inset_0_0_0_1px_var(--accent)]' : 'border-line-2 hover:border-ink',
                c.disabled && 'cursor-not-allowed opacity-50',
              )}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                  <Icon name={c.icon} size={18} />
                  {c.title}
                </span>
                {c.badge ? <span className="rounded-pill bg-teal-text px-2 py-0.5 text-[11px] font-semibold text-surface">{c.badge}</span> : null}
              </span>
              <span className="text-[12.5px] leading-snug text-ink-2">{c.line}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
