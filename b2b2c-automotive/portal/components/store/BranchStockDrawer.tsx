'use client';

// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Stock and optional price per branch (workstream U-05, Q-005, Q-003): the store's assigned parts with the branch's stock and
// branch price. An empty price means "Store price applies". Writes go to the stock route, which checks the branch and the SKU.
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Dialog } from '@/components/portal/Dialog';
import { buttonSecondary, buttonSmall, errorNote, hintClass, inputClass, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { failureText } from '@/hooks/sellerHttp';
import { useBranchStock, useStoreActions } from '@/hooks/storeApi';
import { STOCK_MAX } from '@/lib/store/schemas';
import type { Branch, StockRow } from '@/lib/store/types';
import { localName } from './local-name';

interface Draft {
  stock: string;
  price: string;
}

/** Cents of a typed price ("12,50" or "12.5"); null for empty (clears the branch price); NaN when invalid. */
export function parsePriceCent(value: string): number | null {
  const text = value.trim().replace(',', '.');
  if (text === '') return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return Number.NaN;
  const cents = Math.round(Number(text) * 100);
  return cents > 0 ? cents : Number.NaN;
}

const centText = (cent: number | null) => (cent === null ? '' : (cent / 100).toFixed(2));
const initial = (row: StockRow): Draft => ({ stock: row.availableQuantity === null ? '' : String(row.availableQuantity), price: centText(row.priceCent) });

export function BranchStockDrawer({ branch, onClose }: { branch: Branch; onClose: () => void }) {
  const t = useTranslations('store.branches.stock');
  const locale = useLocale();
  const { toast } = useToast();
  const { setStock } = useStoreActions();
  const [offset, setOffset] = useState(0);
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const { data, error, isLoading } = useBranchStock(branch.key, offset, text);

  const draftOf = (row: StockRow): Draft => drafts[row.sku] ?? initial(row);
  const edit = (row: StockRow, change: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [row.sku]: { ...draftOf(row), ...change } }));
  const dirty = (row: StockRow) => {
    const draft = drafts[row.sku];
    const base = initial(row);
    return draft !== undefined && (draft.stock !== base.stock || draft.price !== base.price);
  };

  async function onSaveRow(row: StockRow) {
    const draft = draftOf(row);
    const base = initial(row);
    const change: { availableQuantity?: number; priceCent?: number | null } = {};
    if (draft.stock !== base.stock) {
      const quantity = Number(draft.stock);
      if (draft.stock.trim() === '' || !Number.isInteger(quantity) || quantity < 0 || quantity > STOCK_MAX) return setErrors((p) => ({ ...p, [row.sku]: t('badStock', { max: STOCK_MAX }) }));
      change.availableQuantity = quantity;
    }
    if (draft.price !== base.price) {
      const cent = parsePriceCent(draft.price);
      if (Number.isNaN(cent)) return setErrors((p) => ({ ...p, [row.sku]: t('badPrice') }));
      change.priceCent = cent;
    }
    setSaving(row.sku);
    setErrors((p) => ({ ...p, [row.sku]: '' }));
    const result = await setStock(branch.key, row.sku, change);
    setSaving(null);
    if (!result.ok) return setErrors((p) => ({ ...p, [row.sku]: failureText(result, t('saveFailed')) }));
    setDrafts((p) => {
      const { [row.sku]: _removed, ...rest } = p;
      void _removed;
      return rest;
    });
    toast(t('saved', { sku: row.sku }));
  }

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? 50;
  const currency = data?.currency ?? 'EUR';

  return (
    <Dialog
      open
      variant="drawer"
      title={t('title', { name: localName(branch.name, locale, branch.key) })}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className={buttonSecondary}>
          {t('close')}
        </button>
      }
    >
      <p className={hintClass}>{t('hint', { currency })}</p>
      <label className="flex flex-col gap-100">
        <span className="text-body-2 font-semibold text-text">{t('search')}</span>
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOffset(0);
          }}
          className={inputClass}
        />
      </label>
      {error ? <p role="alert" className={errorNote}>{t('loadFailed')}</p> : null}
      {isLoading && !data ? <p role="status" className={hintClass}>{t('loading')}</p> : null}
      {data && rows.length === 0 ? <p className={hintClass}>{t('empty')}</p> : null}
      {rows.length > 0 ? (
        <div className={tableScroll}>
          <table className={`w-full ${tableMinWidth}`}>
            <thead>
              <tr>
                <th className={thClass}>{t('sku')}</th>
                <th className={thClass}>{t('name')}</th>
                <th className={thClass}>{t('stockColumn')}</th>
                <th className={thClass}>{t('priceColumn', { currency })}</th>
                <th className={thClass}>
                  <span className="sr-only">{t('actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const draft = draftOf(row);
                return (
                  <tr key={row.sku} className="border-t border-border-subdued">
                    <td className={`${tdClass} font-semibold`}>{row.sku}</td>
                    <td className={tdClass}>{localName(row.name, locale, row.sku)}</td>
                    <td className={tdClass}>
                      <input aria-label={t('stockFor', { sku: row.sku })} inputMode="numeric" value={draft.stock} placeholder={t('noEntry')} onChange={(e) => edit(row, { stock: e.target.value })} className={inputClass} />
                    </td>
                    <td className={tdClass}>
                      <input aria-label={t('priceFor', { sku: row.sku })} inputMode="decimal" value={draft.price} placeholder={t('storePrice')} onChange={(e) => edit(row, { price: e.target.value })} className={inputClass} />
                    </td>
                    <td className={tdClass}>
                      <button type="button" onClick={() => onSaveRow(row)} disabled={!dirty(row) || saving === row.sku} className={buttonSmall}>
                        {saving === row.sku ? t('saving') : t('save')}
                      </button>
                      {errors[row.sku] ? (
                        <p role="alert" className="mt-100 text-caption-1 font-semibold text-text-critical">
                          {errors[row.sku]}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      {total > limit ? (
        <div className="flex items-center justify-between gap-300">
          <button type="button" onClick={() => setOffset(Math.max(0, offset - limit))} disabled={offset === 0} className={buttonSmall}>
            {t('previous')}
          </button>
          <span className={hintClass}>{t('range', { from: offset + 1, to: Math.min(offset + limit, total), total })}</span>
          <button type="button" onClick={() => setOffset(offset + limit)} disabled={offset + limit >= total} className={buttonSmall}>
            {t('next')}
          </button>
        </div>
      ) : null}
    </Dialog>
  );
}
