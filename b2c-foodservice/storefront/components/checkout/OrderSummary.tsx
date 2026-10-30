'use client';

import { useTranslations } from 'next-intl';
import LineImage from '@/components/cart/LineImage';
import { useMoney } from '@/components/cart/use-cart-ui';
import Card from '@/components/ui/Card';
import type { CheckoutState } from '@/lib/types';
import { LineMarker } from './ClusterLine';

function Row({ label, value, tone }: { label: string; value: string; tone?: 'discount' }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[13.5px]">
      <dt className="text-ink-2">{label}</dt>
      <dd className={`m-0 ${tone === 'discount' ? 'text-teal-text' : 'text-ink'}`}>{value}</dd>
    </div>
  );
}

/**
 * The summary card, sticky beside the stage. It renders `state.summary` only (the engine's figures from the last response): no
 * promo input here (codes are entered on the bag page and read back), no tax rate, no free-shipping threshold of its own.
 * `instore` (workstream R): the figures only. The Review stage above already lists the lines, so the list is not repeated.
 */
export default function OrderSummary({ state, instore = false }: { state: CheckoutState; instore?: boolean }) {
  const t = useTranslations('checkout');
  const money = useMoney();
  const s = state.summary;
  const m = (cents: number) => money({ centAmount: cents, currencyCode: s.currency });
  const count = state.cart.lines.reduce((n, l) => n + l.quantity, 0);
  const applied = state.codes.filter((c) => c.state === 'applied');

  return (
    <Card as="section" aria-labelledby="checkout-summary-title" className={instore ? '' : 'stack:sticky stack:top-24'}>
      <h2 id="checkout-summary-title" className="m-0 mb-3 font-display text-[18px] font-bold">
        {instore ? t('summary.title') : t('summary.items', { count })}
      </h2>
      <ul hidden={instore} className="m-0 mb-4 max-h-[200px] list-none overflow-y-auto p-0" data-testid="summary-lines">
        {state.cart.lines.map((l) => (
          <li key={l.id} className="flex items-start gap-3 py-2">
            <LineImage {...(l.imageUrl ? { url: l.imageUrl } : {})} alt={l.imageAlt} width={48} height={58} />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[13px] font-semibold text-ink">{l.name}</p>
              <p className="m-0 text-[11.5px] text-ink-3">{[l.variantSummary, t('summary.quantity', { quantity: l.quantity })].filter(Boolean).join(' · ')}</p>
              <LineMarker line={l} />
            </div>
            <span className="shrink-0 text-[13px] font-semibold">{money(l.total)}</span>
          </li>
        ))}
      </ul>
      <dl className="m-0 flex flex-col gap-2.5 border-t border-line pt-3.5">
        <Row label={t('summary.subtotal')} value={m(s.subtotalCents)} />
        {s.discountCents > 0 ? <Row label={t('summary.discount')} value={`-${m(s.discountCents)}`} tone="discount" /> : null}
        <Row
          label={t('summary.shipping')}
          value={s.shippingCents === null ? t('summary.nextStep') : s.shippingFree ? t('summary.free') : m(s.shippingCents)}
        />
        <Row label={t('summary.tax')} value={s.taxCents === null ? t('summary.nextStep') : m(s.taxCents)} />
      </dl>
      {applied.length > 0 ? (
        <ul aria-label={t('summary.codes')} className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
          {applied.map((c) => (
            <li key={c.code} data-testid="code-pill" className="rounded-pill bg-canvas-2 px-3 py-1 text-[12px] font-semibold text-teal-text">
              {c.code}
            </li>
          ))}
        </ul>
      ) : null}
      {state.codes.filter((c) => c.state === 'not_applicable').map((c) => (
        <p key={c.code} className="m-0 mt-2 text-[12.5px] text-ink-3">
          {c.code}: {c.reason ? t(`promo.reasons.${c.reason as 'NotValid'}`) : ''}
        </p>
      ))}
      <div className="mt-3.5 flex items-baseline justify-between gap-4 border-t border-line pt-3.5 font-display text-[16px] font-bold">
        <span>{t('summary.total')}</span>
        <span data-testid="checkout-total">{m(s.totalCents)}</span>
      </div>
    </Card>
  );
}
