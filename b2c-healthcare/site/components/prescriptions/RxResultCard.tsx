'use client';
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Link } from '@/i18n/routing';
import { formatIsoDate } from '@/lib/format-date';
import { COUNTRY_CONFIG, DEFAULT_LOCALE, formatMoney, isSupportedLocale } from '@/lib/utils';
import type { RxView } from '@/lib/types';
import { MedicationRow } from './MedicationRow';

export interface RxResultCardProps {
  view: RxView;
  /** Adds the selected lines to the cart (injected; the cart workstream owns the endpoint). */
  onAdd: (rxNumber: string, lineRefs: string[]) => Promise<void>;
  /** Called after a successful add (the page shows the toast). */
  onAdded?: () => void;
  /** "Save to My medicines" (workstream T): saves the selected rows (all rows when none is selected). Absent = no button. */
  onSave?: (rxNumber: string, lineRefs: string[]) => Promise<{ saved: number; alreadySaved: number }>;
}

/**
 * Prescription card: number, prescriber and date, patient and refill badges, select-all, one row per medication,
 * selected count and total, "Add to cart". Rows that cannot be dispensed are listed but never selected.
 * The total sums the catalog pack prices the server sent; it is informational (the platform cart is authoritative).
 */
export function RxResultCard({ view, onAdd, onAdded, onSave }: RxResultCardProps) {
  const t = useTranslations('rx');
  const locale = useLocale();
  const selectable = view.lines.filter((l) => l.selectable);
  const [selected, setSelected] = useState<Record<string, boolean>>(() => Object.fromEntries(selectable.map((l) => [l.lineRef, true])));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'already' | 'failed'>('idle');

  const chosen = selectable.filter((l) => selected[l.lineRef]);
  const total = chosen.reduce((sum, l) => sum + (l.price?.centAmount ?? 0), 0);
  const currency = chosen.find((l) => l.price)?.price?.currencyCode ?? view.lines.find((l) => l.price)?.price?.currencyCode ?? COUNTRY_CONFIG[isSupportedLocale(locale) ? locale : DEFAULT_LOCALE].currency;
  const allChosen = selectable.length > 0 && chosen.length === selectable.length;
  const hasLimit = view.lines.some((l) => l.status === 'CEILING' && l.scope === 'period');

  async function add() {
    setBusy(true);
    setFailed(false);
    try {
      await onAdd(view.number, chosen.map((l) => l.lineRef));
      onAdded?.();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!onSave) return;
    setSaving(true);
    setSaveState('idle');
    try {
      const refs = chosen.length > 0 ? chosen.map((l) => l.lineRef) : view.lines.map((l) => l.lineRef);
      const result = await onSave(view.number, refs);
      setSaveState(result.saved > 0 ? 'saved' : 'already');
    } catch {
      setSaveState('failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section" aria-labelledby="rx-number" data-rx-card>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 id="rx-number" className="font-display text-2xl font-semibold text-navy-900">
            {view.number}
          </h2>
          <p className="text-sm text-neutral-600">{t('prescribedBy', { doctor: view.prescriber, date: formatIsoDate(view.issuedAt, locale) })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{t('patient', { name: view.patientName })}</Badge>
          <Badge variant={view.refillsLeft > 0 ? 'ok' : 'no'}>{t('refillsLeft', { count: view.refillsLeft })}</Badge>
        </div>
      </div>
      <label className="flex cursor-pointer items-center gap-3 pt-4 text-sm font-medium text-navy-900">
        <input
          type="checkbox"
          className="size-5 accent-brand-500 disabled:cursor-not-allowed"
          checked={allChosen}
          disabled={selectable.length === 0}
          onChange={(e) => setSelected(Object.fromEntries(selectable.map((l) => [l.lineRef, e.target.checked])))}
        />
        {t('selectAll')}
      </label>
      <ul className="m-0 list-none p-0">
        {view.lines.map((line) => (
          <MedicationRow key={line.lineRef} line={line} checked={line.selectable && !!selected[line.lineRef]} onChange={(on) => setSelected((s) => ({ ...s, [line.lineRef]: on }))} />
        ))}
      </ul>
      {hasLimit ? <p className="pb-3 text-sm text-neutral-600">{t('monthlyNote')}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <span className="text-neutral-600" data-selected-count>
            {t('selected', { count: chosen.length })} ·{' '}
          </span>
          <b className="text-xl text-navy-700" data-total>
            {formatMoney(total, currency, locale)}
          </b>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {onSave ? (
            <Button variant="outline" onClick={() => void save()} busy={saving} data-save-to-list>
              {saving ? t('saving') : t('saveToList')}
            </Button>
          ) : null}
          <Button onClick={add} disabled={chosen.length === 0} busy={busy}>
            {busy ? t('adding') : t('addToCart')}
          </Button>
        </div>
      </div>
      {saveState === 'saved' || saveState === 'already' ? (
        <p role="status" className="pt-3 font-medium text-navy-900" data-save-result>
          {saveState === 'saved' ? t('saved') : t('savedAlready')}{' '}
          <Link href="/account/lists" className="text-text-link">
            {t('viewList')}
          </Link>
        </p>
      ) : null}
      {saveState === 'failed' ? (
        <p role="alert" className="pt-3 font-medium text-danger-700">
          {t('saveFailed')}
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="pt-3 font-medium text-danger-700">
          {t('addFailed')}
        </p>
      ) : null}
    </Card>
  );
}
