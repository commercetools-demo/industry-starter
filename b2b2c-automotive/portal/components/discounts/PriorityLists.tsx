/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Chip } from '@/components/catalog/Chip';
import { buttonPrimary, buttonSmall, cardClass, errorNote, infoNote } from '@/components/catalog/ui';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { discountApi, useDiscounts, useRefreshCatalog } from '@/hooks/catalogApi';
import { usePermissions } from '@/hooks/usePermissions';
import type { DiscountKind, DiscountView } from '@/lib/catalog/types';
import { getLocalizedString } from '@/lib/utils';
import { useDiscountText } from './DiscountList';

/** Reorders `ids` by moving one id; stops at the ends (a row never leaves its own kind's list). */
export function move(ids: readonly string[], id: string, delta: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  next.splice(to, 0, next.splice(from, 1)[0]);
  return next;
}

function KindList({ kind, order, setOrder, rows, canEdit }: { kind: DiscountKind; order: string[]; setOrder: (ids: string[]) => void; rows: DiscountView[]; canEdit: boolean }) {
  const t = useTranslations('catalog.priority');
  const locale = useLocale();
  const text = useDiscountText();
  const malva = rows.filter((d) => d.funded === 'malva');
  const own = order.map((id) => rows.find((d) => d.id === id)).filter((d): d is DiscountView => Boolean(d));
  return (
    <section className={`${cardClass} flex flex-col gap-300`} aria-labelledby={`prio-${kind}`}>
      <h2 id={`prio-${kind}`} className="text-title-1 font-semibold text-text">
        {t(`${kind}.title`)}
      </h2>
      <ol className="flex flex-col gap-200">
        {malva.map((d) => (
          <li key={d.id} data-testid="locked-row" className="flex items-center gap-300 rounded-300 border border-border-subdued bg-bg-surface-subdued px-300 py-250">
            <span className="w-800 text-center text-body-2 font-bold text-text-subdued">{t('noRank')}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-body-2 font-semibold text-text">{getLocalizedString(d.name, locale)}</span>
              <span className="text-caption-1 text-text-subdued">{text.effect(d)}</span>
            </span>
            <Chip tone="info">{t('malva')}</Chip>
            <span className="text-caption-1 font-semibold text-text-subdued">{t('locked')}</span>
          </li>
        ))}
        {own.map((d, i) => {
          const name = getLocalizedString(d.name, locale);
          return (
            <li key={d.id} className="flex items-center gap-300 rounded-300 border border-border-subdued px-300 py-250">
              <span className="w-800 text-center text-body-2 font-bold text-text">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-2 font-semibold text-text">{name}</span>
                <span className="text-caption-1 text-text-subdued">{text.effect(d)}</span>
              </span>
              <Chip tone="neutral">{t('yours')}</Chip>
              <span className="flex gap-100">
                <button type="button" className={buttonSmall} aria-label={t('moveUp', { name })} disabled={!canEdit || i === 0} onClick={() => setOrder(move(order, d.id, -1))}>
                  ↑
                </button>
                <button type="button" className={buttonSmall} aria-label={t('moveDown', { name })} disabled={!canEdit || i === own.length - 1} onClick={() => setOrder(move(order, d.id, 1))}>
                  ↓
                </button>
              </span>
            </li>
          );
        })}
        {malva.length + own.length === 0 ? <li className="text-body-2 text-text-subdued">{t('empty')}</li> : null}
      </ol>
    </section>
  );
}

/** The "Discount priority" tab: Malva-funded rows locked at the top, the store's own rows ranked 1 to n within their kind. */
export function PriorityLists() {
  const t = useTranslations('catalog.priority');
  const tp = useTranslations('permissions');
  const { storeKey } = useViewer();
  const { can } = usePermissions();
  const { toast } = useToast();
  const refresh = useRefreshCatalog();
  const canEdit = can('discount.edit');
  const product = useDiscounts(storeKey, 'product');
  const cart = useDiscounts(storeKey, 'cart');
  const ownIds = (rows: DiscountView[] | undefined) => (rows ?? []).filter((d) => d.funded === 'store').map((d) => d.id);
  const serverOrder = useMemo(() => ({ product: ownIds(product.data), cart: ownIds(cart.data) }), [product.data, cart.data]);
  // The order being edited per kind; it only counts while it holds exactly the server's discounts (a reload drops a stale edit).
  const [edited, setEdited] = useState<Partial<Record<DiscountKind, string[]>>>({});
  const order = useMemo(() => {
    const pick = (kind: DiscountKind) => {
      const mine = edited[kind];
      return mine && mine.length === serverOrder[kind].length && mine.every((id) => serverOrder[kind].includes(id)) ? mine : serverOrder[kind];
    };
    return { product: pick('product'), cart: pick('cart') };
  }, [edited, serverOrder]);
  const setOrder = (next: { product: string[]; cart: string[] }) => setEdited(next);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const dirty = (kind: DiscountKind) => order[kind].join() !== serverOrder[kind].join();

  async function save() {
    setBusy(true);
    setProblem('');
    for (const kind of ['product', 'cart'] as const) {
      if (!dirty(kind)) continue;
      const result = await discountApi.reorder(storeKey, kind, order[kind]);
      if (!result.ok) {
        setBusy(false);
        setProblem(result.code === 'STALE_LIST' ? t('errors.stale') : result.status === 403 ? tp('insufficient') : t('errors.generic'));
        if (result.code === 'STALE_LIST') await refresh();
        return;
      }
    }
    setBusy(false);
    setEdited({});
    toast(t('saved'));
    await refresh();
  }

  return (
    <div className="flex flex-col gap-400">
      <section className={`${cardClass} flex flex-col gap-200`}>
        <p data-testid="layers" className="text-title-2 font-semibold text-text">
          {t('layers')}
        </p>
        <p className="text-body-2 font-medium text-text-subdued">{t('rule')}</p>
      </section>
      {!canEdit ? <p role="note" className={infoNote}>{tp('insufficient')}</p> : null}
      {problem ? <p role="alert" className={errorNote}>{problem}</p> : null}
      <div className="grid gap-400 lg:grid-cols-2">
        <KindList kind="product" order={order.product} setOrder={(ids) => setOrder({ ...order, product: ids })} rows={product.data ?? []} canEdit={canEdit} />
        <KindList kind="cart" order={order.cart} setOrder={(ids) => setOrder({ ...order, cart: ids })} rows={cart.data ?? []} canEdit={canEdit} />
      </div>
      <div className="flex justify-end">
        <button type="button" className={buttonPrimary} disabled={!canEdit || busy || (!dirty('product') && !dirty('cart'))} title={!canEdit ? tp('insufficient') : undefined} onClick={save}>
          {t('save')}
        </button>
      </div>
    </div>
  );
}
