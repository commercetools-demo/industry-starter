/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { buttonPrimary, buttonSecondary, cardClass, errorNote, hintClass, infoNote, inputClass, labelClass } from '@/components/catalog/ui';
import { Link, useRouter } from '@/i18n/routing';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { discountApi, useCategories, useDiscount, useRefreshCatalog } from '@/hooks/catalogApi';
import { usePermissions } from '@/hooks/usePermissions';
import { describeRule, previewRule, validateRule, type CartRule, type ProductRule, type RuleIssue } from '@/lib/catalog/discount-rule';
import { formFromRule, ruleFromForm, type DiscountForm } from '@/lib/catalog/discount-form';
import { parsePriceInput } from '@/lib/catalog/price-input';
import type { DiscountKind } from '@/lib/catalog/types';
import { formatMoney, getLocalizedString } from '@/lib/utils';
import { useDiscountText } from './DiscountList';

type Locale = 'de-DE' | 'en-US';

/** The sample cart's shipping cost, so a free-shipping rule has something to save. */
const SAMPLE_SHIPPING = 590;

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-150">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-caption-1 font-semibold text-text-critical">
          {error}
        </p>
      ) : hint ? (
        <p className={hintClass}>{hint}</p>
      ) : null}
    </div>
  );
}

type Detail = NonNullable<ReturnType<typeof useDiscount>['data']>;

/** Loads one discount; a Malva-funded rule or one made outside the portal is shown read-only, any other opens the form. */
export function DiscountEditor({ kind, id }: { kind: DiscountKind; id: string }) {
  const t = useTranslations('catalog.editor');
  const locale = useLocale() as Locale;
  const { storeKey } = useViewer();
  const text = useDiscountText();
  const { data: discount, error: loadError } = useDiscount(storeKey, kind, id);

  if (loadError) {
    return (
      <p role="alert" className={errorNote}>
        {t('errors.notFound')}
      </p>
    );
  }
  if (!discount) return <p className={hintClass}>…</p>;

  if (discount.rule === null || discount.funded === 'malva') {
    return (
      <section className={`${cardClass} flex flex-col gap-300`}>
        <h2 className="text-title-1 font-semibold text-text">{getLocalizedString(discount.name, locale)}</h2>
        <p className={infoNote}>{discount.funded === 'malva' ? t('lockedMalva') : t('readOnlyRule')}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-400 gap-y-100 text-body-2">
          <dt className="font-semibold text-text-subdued">{t('summary')}</dt>
          <dd>{text.scope(discount)} · {text.effect(discount)}</dd>
          <dt className="font-semibold text-text-subdued">{t('predicate')}</dt>
          <dd className="font-mono text-caption-1">{discount.predicate}</dd>
        </dl>
        <Link href={kind === 'product' ? '/catalog/product-discounts' : '/catalog/cart-discounts'} className={`${buttonSecondary} w-max`}>
          {t('back')}
        </Link>
      </section>
    );
  }
  return <EditorForm kind={kind} id={id} discount={discount as Detail & { rule: ProductRule | CartRule }} />;
}

/** The editor of one discount: target, effect, schedule, stacking, code, a plain-language summary and a preview on a sample cart. */
function EditorForm({ kind, id, discount }: { kind: DiscountKind; id: string; discount: Detail & { rule: ProductRule | CartRule } }) {
  const t = useTranslations('catalog.editor');
  const tp = useTranslations('permissions');
  const locale = useLocale() as Locale;
  const router = useRouter();
  const { storeKey } = useViewer();
  const { can } = usePermissions();
  const { toast } = useToast();
  const refresh = useRefreshCatalog();
  const { data: categories } = useCategories(storeKey);
  const [form, setForm] = useState<DiscountForm>(() => formFromRule(discount.rule, locale));
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [sampleTotal, setSampleTotal] = useState('2500,00');
  const [sampleInCategory, setSampleInCategory] = useState(true);
  const canEdit = can('discount.edit');

  const rule = useMemo<ProductRule | CartRule>(() => ruleFromForm(form, kind), [form, kind]);
  const issues = useMemo(() => validateRule(rule), [rule]);
  const issue = (field: RuleIssue['field']) => issues.find((i) => i.field === field)?.message;
  const set = <K extends keyof DiscountForm>(key: K, value: DiscountForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  const sampleCents = (() => {
    const p = parsePriceInput(sampleTotal);
    return p.kind === 'ok' ? p.centAmount : 0;
  })();
  const categoryId = kind === 'cart' ? (rule as CartRule).condition.kind === 'category' ? ((rule as CartRule).condition as { categoryId: string }).categoryId : undefined : (rule as ProductRule).scope.kind === 'category' ? ((rule as ProductRule).scope as { categoryId: string }).categoryId : undefined;
  const preview = previewRule(rule, { lines: [{ sku: 'SAMPLE-1', unitCents: sampleCents, quantity: 1, categoryId: categoryId && sampleInCategory ? categoryId : undefined }], shippingCents: SAMPLE_SHIPPING });

  async function save() {
    setBusy(true);
    setProblem('');
    const result = await discountApi.save(storeKey, kind, id, rule);
    setBusy(false);
    if (!result.ok) {
      const first = (result.details as { issues?: RuleIssue[] } | undefined)?.issues?.[0];
      setProblem(first?.message ?? (result.code === 'CODE_TAKEN' ? t('errors.codeTaken') : result.status === 403 ? tp('insufficient') : t('errors.generic')));
      return;
    }
    toast(t('saved'));
    await refresh();
    router.push(kind === 'product' ? '/catalog/product-discounts' : '/catalog/cart-discounts');
  }

  const nameIssue = issue('name');
  return (
    <div className="grid gap-400 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className={`${cardClass} flex flex-col gap-400`} aria-labelledby="editor-heading">
        <div>
          <h2 id="editor-heading" className="text-title-1 font-semibold text-text">
            {discount.draft ? t(`${kind}.newTitle`) : t(`${kind}.editTitle`)}
          </h2>
          <p className={hintClass}>{t('inactiveNote')}</p>
        </div>
        {!can('discount.edit') ? <p role="note" className={infoNote}>{tp('insufficient')}</p> : null}

        <fieldset disabled={!canEdit || busy} className="flex flex-col gap-400">
          <div className="grid gap-300 sm:grid-cols-2">
            <Field id="d-name-de" label={`${t('name')} (de-DE)`} error={nameIssue}>
              <input id="d-name-de" value={form.nameDe} onChange={(e) => set('nameDe', e.target.value)} className={inputClass} />
            </Field>
            <Field id="d-name-en" label={`${t('name')} (en-US)`}>
              <input id="d-name-en" value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} className={inputClass} />
            </Field>
          </div>

          {kind === 'product' ? (
            <>
              <Field id="d-scope" label={t('target')} error={issue('scope')}>
                <select id="d-scope" value={form.scopeKind} onChange={(e) => set('scopeKind', e.target.value as DiscountForm['scopeKind'])} className={inputClass}>
                  <option value="all">{t('scope.all')}</option>
                  <option value="category">{t('scope.category')}</option>
                  <option value="skus">{t('scope.skus')}</option>
                </select>
              </Field>
              {form.scopeKind === 'category' ? (
                <Field id="d-category" label={t('category')}>
                  <select
                    id="d-category"
                    value={form.categoryId}
                    onChange={(e) => {
                      const c = categories?.find((x) => x.id === e.target.value);
                      setForm((f) => ({ ...f, categoryId: e.target.value, categoryLabel: c ? getLocalizedString(c.name, locale) : '' }));
                    }}
                    className={inputClass}
                  >
                    <option value="">{t('chooseCategory')}</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {getLocalizedString(c.name, locale)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              {form.scopeKind === 'skus' ? (
                <Field id="d-skus" label={t('skus')} hint={t('skusHint')}>
                  <input id="d-skus" value={form.skus} onChange={(e) => set('skus', e.target.value)} className={inputClass} />
                </Field>
              ) : null}
            </>
          ) : (
            <>
              <Field id="d-condition" label={t('condition')} error={issue('condition')}>
                <select id="d-condition" value={form.conditionKind} onChange={(e) => set('conditionKind', e.target.value as DiscountForm['conditionKind'])} className={inputClass}>
                  <option value="always">{t('conditions.always')}</option>
                  <option value="cartTotalAtLeast">{t('conditions.cartTotalAtLeast')}</option>
                  <option value="category">{t('conditions.category')}</option>
                </select>
              </Field>
              {form.conditionKind === 'cartTotalAtLeast' ? (
                <Field id="d-amount" label={t('cartTotal')} hint={t('moneyHint')}>
                  <input id="d-amount" inputMode="decimal" value={form.amount} onChange={(e) => set('amount', e.target.value)} className={inputClass} />
                </Field>
              ) : null}
              {form.conditionKind === 'category' ? (
                <Field id="d-category" label={t('category')}>
                  <select id="d-category" value={form.categoryId} onChange={(e) => set('categoryId', e.target.value)} className={inputClass}>
                    <option value="">{t('chooseCategory')}</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {getLocalizedString(c.name, locale)}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
            </>
          )}

          <div className="grid gap-300 sm:grid-cols-2">
            <Field id="d-effect" label={t('effect')}>
              <select id="d-effect" value={form.effectKind} onChange={(e) => set('effectKind', e.target.value as DiscountForm['effectKind'])} className={inputClass}>
                <option value="relative">{t('effects.relative')}</option>
                <option value="absolute">{t('effects.absolute')}</option>
                {kind === 'cart' ? <option value="freeShipping">{t('effects.freeShipping')}</option> : null}
              </select>
            </Field>
            {form.effectKind !== 'freeShipping' ? (
              <Field id="d-value" label={form.effectKind === 'relative' ? t('percent') : t('amount')} error={issue('effect')} hint={form.effectKind === 'relative' ? t('percentHint') : t('moneyHint')}>
                <input id="d-value" inputMode="decimal" value={form.value} onChange={(e) => set('value', e.target.value)} className={inputClass} aria-invalid={Boolean(issue('effect'))} aria-describedby={issue('effect') ? 'd-value-error' : undefined} />
              </Field>
            ) : null}
          </div>

          <div className="grid gap-300 sm:grid-cols-2">
            <Field id="d-from" label={t('validFrom')} error={issue('validFrom')}>
              <input id="d-from" type="date" value={form.validFrom} onChange={(e) => set('validFrom', e.target.value)} className={inputClass} />
            </Field>
            <Field id="d-until" label={t('validUntil')} error={issue('validUntil')}>
              <input id="d-until" type="date" value={form.validUntil} onChange={(e) => set('validUntil', e.target.value)} className={inputClass} />
            </Field>
          </div>

          {kind === 'cart' ? (
            <div className="grid gap-300 sm:grid-cols-2">
              <Field id="d-stacking" label={t('stacking')} hint={t('stackingHint')}>
                <select id="d-stacking" value={form.stacking} onChange={(e) => set('stacking', e.target.value as DiscountForm['stacking'])} className={inputClass}>
                  <option value="Stacking">{t('stackingOptions.Stacking')}</option>
                  <option value="StopAfterThisDiscount">{t('stackingOptions.StopAfterThisDiscount')}</option>
                </select>
              </Field>
              <Field id="d-code" label={t('code')} hint={t('codeHint')} error={issue('code')}>
                <input id="d-code" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} className={`${inputClass} font-mono`} />
              </Field>
            </div>
          ) : null}
        </fieldset>

        {problem ? <p role="alert" className={errorNote}>{problem}</p> : null}
        <div className="flex flex-wrap justify-end gap-300">
          <Link href={kind === 'product' ? '/catalog/product-discounts' : '/catalog/cart-discounts'} className={buttonSecondary}>
            {t('back')}
          </Link>
          <button type="button" className={buttonPrimary} disabled={!canEdit || busy || issues.length > 0} onClick={save}>
            {t('save')}
          </button>
        </div>
      </section>

      <div className="flex flex-col gap-400">
        <section className={`${cardClass} flex flex-col gap-200`} aria-labelledby="summary-title">
          <h3 id="summary-title" className="text-title-2 font-semibold text-text">
            {t('summary')}
          </h3>
          <p data-testid="rule-summary" className="text-body-2 text-text">{issues.length === 0 ? describeRule(rule, locale) : t('incomplete')}</p>
        </section>
        <section className={`${cardClass} flex flex-col gap-300`} aria-labelledby="preview-title">
          <h3 id="preview-title" className="text-title-2 font-semibold text-text">
            {t('preview.title')}
          </h3>
          <Field id="d-sample" label={t('preview.sample')}>
            <input id="d-sample" inputMode="decimal" value={sampleTotal} onChange={(e) => setSampleTotal(e.target.value)} className={inputClass} />
          </Field>
          {categoryId ? (
            <label className="flex items-center gap-200 text-body-2">
              <input type="checkbox" checked={sampleInCategory} onChange={(e) => setSampleInCategory(e.target.checked)} />
              {t('preview.inCategory')}
            </label>
          ) : null}
          <div data-testid="preview" className="flex flex-col gap-100 rounded-300 bg-bg-surface-subdued p-300 text-body-2">
            <span className="flex justify-between"><span>{t('preview.cart')}</span><span>{formatMoney(sampleCents, 'EUR', locale)}</span></span>
            <span className="flex justify-between"><span>{t('preview.shipping')}</span><span>{formatMoney(SAMPLE_SHIPPING, 'EUR', locale)}</span></span>
            {preview.lines.map((l) => (
              <span key={l.label} data-testid="preview-line" className="flex justify-between font-semibold text-text-success">
                <span>{l.label}</span>
                <span>{`−${formatMoney(-l.cents, 'EUR', locale)}`}</span>
              </span>
            ))}
            {!preview.applies ? <span className="text-text-subdued">{issues.length ? t('preview.incomplete') : t('preview.none')}</span> : null}
            <span className="flex justify-between border-t border-border-subdued pt-100 font-semibold"><span>{t('preview.total')}</span><span>{formatMoney(preview.totalAfter, 'EUR', locale)}</span></span>
          </div>
          <p className={hintClass}>{t('preview.note')}</p>
        </section>
      </div>
    </div>
  );
}
