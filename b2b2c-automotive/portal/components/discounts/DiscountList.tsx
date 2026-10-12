'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Chip } from '@/components/catalog/Chip';
import { ConfirmDialog } from '@/components/catalog/ConfirmDialog';
import { buttonPrimary, buttonSmall, cardClass, errorNote, infoNote, tableMinWidth, tableScroll, tdClass, thClass } from '@/components/catalog/ui';
import { Link, useRouter } from '@/i18n/routing';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { discountApi, useDiscounts, useRefreshCatalog } from '@/hooks/catalogApi';
import { usePermissions } from '@/hooks/usePermissions';
import { describeEffect, describeScope } from '@/lib/catalog/discount-rule';
import type { DiscountKind, DiscountView } from '@/lib/catalog/types';
import { getLocalizedString } from '@/lib/utils';

type Locale = 'de-DE' | 'en-US';

export function useDiscountText() {
  const locale = useLocale() as Locale;
  return {
    scope: (d: DiscountView) => (d.scope.kind === 'custom' ? d.scope.text : describeScope(d.scope, locale)),
    effect: (d: DiscountView) => (d.effect.kind === 'custom' ? d.effect.text : describeEffect(d.effect, locale, 'EUR', d.kind)),
  };
}

function Switch({ checked, disabled, label, onChange }: { checked: boolean; disabled: boolean; label: string; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={`relative h-800 w-1500 flex-none rounded-full border border-border transition-colors disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-border-active ${checked ? 'bg-bg-success' : 'bg-bg-surface-subdued'}`}
    >
      <span aria-hidden="true" className={`absolute top-050 size-600 rounded-full bg-bg-surface shadow-button transition-all ${checked ? 'left-[calc(100%-var(--space-600)-var(--space-050))]' : 'left-050'}`} />
    </button>
  );
}

/** The "Product discounts" and "Cart discounts" tabs: list with an Active toggle, "New ... discount" and the Malva-funded rows locked. */
export function DiscountList({ kind }: { kind: DiscountKind }) {
  const t = useTranslations('catalog.discounts');
  const tp = useTranslations('permissions');
  const locale = useLocale();
  const router = useRouter();
  const { storeKey } = useViewer();
  const { can } = usePermissions();
  const { toast } = useToast();
  const refresh = useRefreshCatalog();
  const text = useDiscountText();
  const canEdit = can('discount.edit');
  const { data, error, mutate } = useDiscounts(storeKey, kind);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [removing, setRemoving] = useState<DiscountView | null>(null);

  const fail = (status: number, code?: string) => setProblem(status === 403 && code === 'LOCKED_MALVA_FUNDED' ? t('errors.locked') : status === 403 ? tp('insufficient') : code === 'DRAFT_INCOMPLETE' ? t('errors.draft') : t('errors.generic'));

  async function create() {
    setBusy(true);
    setProblem('');
    const result = await discountApi.createDraft(storeKey, kind);
    setBusy(false);
    if (!result.ok || !result.data) return fail(result.status, result.code);
    await refresh();
    router.push(`/catalog/discounts/${kind}/${result.data.id}`);
  }

  async function toggle(d: DiscountView) {
    setProblem('');
    const result = await discountApi.setActive(storeKey, kind, d.id, !d.isActive);
    if (!result.ok) return fail(result.status, result.code);
    await mutate();
  }

  async function remove() {
    if (!removing) return;
    setBusy(true);
    const result = await discountApi.remove(storeKey, kind, removing.id);
    setBusy(false);
    setRemoving(null);
    if (!result.ok) return fail(result.status, result.code);
    toast(t('deleted'));
    await refresh();
  }

  const window = (d: DiscountView) => {
    const fmt = (iso: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(iso));
    if (!d.validFrom && !d.validUntil) return t('noSchedule');
    return `${d.validFrom ? fmt(d.validFrom) : t('open')} – ${d.validUntil ? fmt(d.validUntil) : t('open')}`;
  };

  return (
    <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby={`discounts-${kind}`}>
      <div className="flex flex-wrap items-center justify-between gap-300">
        <h2 id={`discounts-${kind}`} className="text-title-1 font-semibold text-text">
          {t(`${kind}.title`)}
        </h2>
        <button type="button" className={buttonPrimary} disabled={!canEdit || busy} title={!canEdit ? tp('insufficient') : undefined} onClick={create}>
          {t(`${kind}.new`)}
        </button>
      </div>
      {!canEdit ? <p role="note" className={infoNote}>{tp('insufficient')}</p> : null}
      {problem ? <p role="alert" className={errorNote}>{problem}</p> : null}
      {error ? <p role="alert" className={errorNote}>{t('errors.load')}</p> : null}
      <div className={tableScroll}>
        <table className={`w-full border-collapse ${tableMinWidth}`}>
          <caption className="sr-only">{t(`${kind}.title`)}</caption>
          <thead>
            <tr className="border-b border-border-subdued">
              <th scope="col" className={thClass}>{t('columns.name')}</th>
              <th scope="col" className={thClass}>{t('columns.scope')}</th>
              <th scope="col" className={thClass}>{t('columns.effect')}</th>
              <th scope="col" className={thClass}>{t('columns.runs')}</th>
              <th scope="col" className={thClass}>{t('columns.active')}</th>
              <th scope="col" className={`${thClass} text-right`}>{t('columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {(data ?? []).map((d) => {
              const locked = d.funded === 'malva';
              const name = getLocalizedString(d.name, locale);
              return (
                <tr key={d.id} className={`border-b border-border-subdued last:border-0 ${locked ? 'opacity-80' : ''}`}>
                  <td className={tdClass}>
                    <span className="block font-semibold">{name}</span>
                    <span className="mt-050 flex flex-wrap items-center gap-150">
                      {locked ? <Chip tone="info">{t('malvaFunded')}</Chip> : null}
                      {d.draft ? <Chip tone="neutral">{t('draft')}</Chip> : null}
                      {d.code ? <span className="font-mono text-caption-1 text-text-subdued">{d.code}</span> : null}
                    </span>
                  </td>
                  <td className={tdClass}>{text.scope(d)}</td>
                  <td className={tdClass}>{text.effect(d)}</td>
                  <td className={`${tdClass} text-text-subdued`}>{window(d)}</td>
                  <td className={tdClass}>
                    <Switch checked={d.isActive} disabled={locked || !canEdit} label={t('toggle', { name })} onChange={() => toggle(d)} />
                  </td>
                  <td className={`${tdClass} text-right`}>
                    {locked ? (
                      <span className="text-caption-1 font-semibold text-text-subdued">{t('locked')}</span>
                    ) : (
                      <span className="inline-flex gap-100">
                        <Link href={`/catalog/discounts/${kind}/${d.id}`} className={buttonSmall}>
                          {canEdit ? t('edit') : t('view')}
                        </Link>
                        <button type="button" className={buttonSmall} disabled={!canEdit} onClick={() => setRemoving(d)}>
                          {t('delete')}
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {data && data.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${tdClass} text-center text-text-subdued`}>{t('empty')}</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <ConfirmDialog open={removing !== null} title={t('deleteDialog.title')} confirmLabel={t('deleteDialog.confirm')} cancelLabel={t('deleteDialog.cancel')} busy={busy} onConfirm={remove} onCancel={() => setRemoving(null)}>
        <p>{t('deleteDialog.body', { name: removing ? getLocalizedString(removing.name, locale) : '' })}</p>
      </ConfirmDialog>
    </section>
  );
}
