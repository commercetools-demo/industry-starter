'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent } from 'react';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, buttonSmall, cardClass, errorNote, hintClass, inputClass, sectionTitle, successNote } from '@/components/portal/kit';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { bundleApi, useBundleComponents, type CatalogResult, type ComponentOption } from '@/hooks/marketingApi';
import { bundlePrice } from '@/lib/bundles/price';
import { BUNDLE_LIMITS, validateBundle, type BundleIssue } from '@/lib/bundles/rules';
import { getLocalizedString } from '@/lib/utils';
import { formatEur } from './money';

interface Selected extends ComponentOption {
  qty: number;
}

const LIMIT_VALUES = { min: 0, max: 0 };
function limitsFor(code: string) {
  const L = BUNDLE_LIMITS;
  switch (code) {
    case 'NAME_LENGTH':
      return { min: L.minName, max: L.maxName };
    case 'COMPONENT_COUNT':
      return { min: L.minComponents, max: L.maxComponents };
    case 'QUANTITY_RANGE':
      return { min: L.minQty, max: L.maxQty };
    case 'DISCOUNT_RANGE':
      return { min: L.minDiscount, max: L.maxDiscount };
    default:
      return LIMIT_VALUES;
  }
}

const KNOWN = ['NAME_LENGTH', 'COMPONENT_COUNT', 'COMPONENT_DUPLICATE', 'QUANTITY_RANGE', 'DISCOUNT_RANGE', 'COMPONENT_PRICE', 'BUNDLE_PRICE', 'COMPONENT_NOT_ASSIGNED', 'BUNDLE_EXISTS'];

/** Create form with the live price. The browser uses the same pure functions as the server, which recomputes everything. */
export function BundleForm({ onCreated }: { onCreated: () => void | Promise<unknown> }) {
  const t = useTranslations('bundles');
  const tp = useTranslations('permissions');
  const locale = useLocale();
  const { storeKey } = useViewer();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [discount, setDiscount] = useState('10');
  const [selected, setSelected] = useState<Selected[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const { data, isLoading } = useBundleComponents(storeKey, text.trim());

  const discountPercent = discount.trim() === '' ? Number.NaN : Number(discount);
  const priced = useMemo(() => bundlePrice(selected.map((s) => ({ retailCents: s.retailCents, qty: s.qty })), Number.isFinite(discountPercent) ? discountPercent : 0), [selected, discountPercent]);
  const issues: BundleIssue[] = useMemo(() => {
    const retail = new Map<string, number | null>(selected.map((s) => [s.sku, s.retailCents]));
    return validateBundle({ name, discountPercent, components: selected.map((s) => ({ sku: s.sku, qty: s.qty })) }, retail, priced.bundleCents).filter(
      (i) => (i.code !== 'NAME_LENGTH' || name.trim() !== '') && (i.code !== 'COMPONENT_COUNT' || selected.length > 0) && (i.code !== 'BUNDLE_PRICE' || selected.length > 0),
    );
  }, [name, discountPercent, selected, priced.bundleCents]);

  const message = (code: string, sku?: string) => (KNOWN.includes(code) ? t(`errors.${code}` as 'errors.generic', { ...limitsFor(code), sku: sku ?? '' }) : t('errors.generic'));
  const fail = (result: CatalogResult<unknown>) => {
    if (result.status === 403) return setProblem(tp('insufficient'));
    const sku = typeof result.details?.sku === 'string' ? result.details.sku : undefined;
    setProblem(result.code ? message(result.code, sku) : t('errors.generic'));
  };

  const add = (option: ComponentOption) => setSelected((list) => (list.length >= BUNDLE_LIMITS.maxComponents || list.some((s) => s.sku === option.sku) ? list : [...list, { ...option, qty: 1 }]));
  const setQty = (sku: string, qty: number) => setSelected((list) => list.map((s) => (s.sku === sku ? { ...s, qty } : s)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (issues.length > 0 || busy) return;
    setBusy(true);
    setProblem('');
    const result = await bundleApi.create(storeKey, { name: name.trim(), discountPercent, components: selected.map((s) => ({ sku: s.sku, qty: s.qty })) });
    setBusy(false);
    if (!result.ok) return fail(result);
    toast(t('form.created'));
    setName('');
    setSelected([]);
    await onCreated();
  }

  const options = data?.components ?? [];
  const canSubmit = issues.length === 0 && selected.length > 0 && name.trim() !== '' && !busy;
  return (
    <form onSubmit={submit} className={`${cardClass} flex flex-col gap-500`} aria-labelledby="bundle-form-title" noValidate>
      <h2 id="bundle-form-title" className={sectionTitle}>
        {t('form.title')}
      </h2>
      <div className="grid gap-400 md:grid-cols-2">
        <FormField id="bundle-name" label={t('form.name')}>
          <input id="bundle-name" className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        </FormField>
        <FormField id="bundle-discount" label={t('form.discount')} hint={t('form.discountHint')}>
          <input id="bundle-discount" type="number" inputMode="decimal" step="any" className={inputClass} value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </FormField>
      </div>

      <div className="grid gap-500 lg:grid-cols-2">
        <section aria-labelledby="bundle-picker-title" className="flex flex-col gap-300">
          <h3 id="bundle-picker-title" className="text-body-1 font-semibold text-text">
            {t('form.pickerTitle')}
          </h3>
          <FormField id="bundle-search" label={t('form.search')}>
            <input id="bundle-search" type="search" className={inputClass} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('form.searchPlaceholder')} />
          </FormField>
          {isLoading ? <p className={hintClass}>{t('form.loading')}</p> : null}
          {!isLoading && options.length === 0 ? <p className={hintClass}>{t('form.noResults')}</p> : null}
          <ul className="flex max-h-[calc(var(--space-6400)*2)] flex-col gap-150 overflow-y-auto">
            {options.map((o) => {
              const label = getLocalizedString(o.name, locale) || o.sku;
              const taken = selected.some((s) => s.sku === o.sku);
              return (
                <li key={o.sku} className="flex items-center justify-between gap-300 rounded-200 bg-bg-surface-subdued px-300 py-200">
                  <span className="min-w-0 text-body-2 text-text">
                    <span className="font-semibold">{label}</span> <span className="text-text-subdued">{o.sku}</span>
                    <span className="block text-caption-1 text-text-subdued">{formatEur(o.retailCents, locale)}</span>
                  </span>
                  <button type="button" className={buttonSmall} disabled={taken || selected.length >= BUNDLE_LIMITS.maxComponents} aria-label={t('form.addAria', { name: label })} onClick={() => add(o)}>
                    {taken ? t('form.added') : t('form.add')}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="bundle-components-title" className="flex flex-col gap-300">
          <h3 id="bundle-components-title" className="text-body-1 font-semibold text-text">
            {t('form.components')}
          </h3>
          {selected.length === 0 ? <p className={hintClass}>{t('form.noneSelected')}</p> : null}
          <ul className="flex flex-col gap-200">
            {selected.map((s) => {
              const label = getLocalizedString(s.name, locale) || s.sku;
              return (
                <li key={s.sku} className="flex flex-wrap items-center justify-between gap-300 rounded-200 border border-border px-300 py-200">
                  <span className="min-w-0 text-body-2 font-semibold text-text">
                    {label} <span className="font-medium text-text-subdued">{s.sku}</span>
                  </span>
                  <span className="flex items-center gap-200">
                    <input
                      type="number"
                      min={BUNDLE_LIMITS.minQty}
                      max={BUNDLE_LIMITS.maxQty}
                      aria-label={t('form.quantity', { name: label })}
                      className={`${inputClass} w-1500`}
                      value={s.qty}
                      onChange={(e) => setQty(s.sku, Number(e.target.value))}
                    />
                    <button type="button" className={buttonSmall} aria-label={t('form.remove', { name: label })} onClick={() => setSelected((list) => list.filter((x) => x.sku !== s.sku))}>
                      ×
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <dl aria-label={t('summary.title')} className="grid gap-300 rounded-200 bg-bg-surface-subdued p-400 sm:grid-cols-3">
        <div>
          <dt className={hintClass}>{t('summary.total')}</dt>
          <dd className="text-title-1 font-semibold text-text">{formatEur(priced.totalCents, locale)}</dd>
        </div>
        <div>
          <dt className={hintClass}>{t('summary.price')}</dt>
          <dd className="text-title-1 font-semibold text-text">{formatEur(priced.bundleCents, locale)}</dd>
        </div>
        <div>
          <dt className={hintClass}>{t('summary.saving')}</dt>
          <dd className="text-title-1 font-semibold text-text">{formatEur(priced.savingCents, locale)}</dd>
        </div>
      </dl>

      {issues.length > 0 ? (
        <div role="alert" className={errorNote}>
          <ul className="list-disc pl-600">
            {issues.map((i, n) => (
              <li key={`${i.code}-${i.sku ?? n}`}>{message(i.code)}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className={errorNote}>
          {problem}
        </p>
      ) : null}
      {busy ? <p className={successNote}>{t('form.creating')}</p> : null}
      <div>
        <button type="submit" className={buttonPrimary} disabled={!canSubmit}>
          {t('form.create')}
        </button>
      </div>
    </form>
  );
}
