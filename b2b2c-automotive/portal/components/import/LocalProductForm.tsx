/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the commercetools-labs contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useMemo, useState, type FormEvent } from 'react';
import { useSWRConfig } from 'swr';
import { formatEur } from '@/components/bundles/money';
import { FormField } from '@/components/portal/FormField';
import { buttonPrimary, cardClass, errorNote, hintClass, inputClass, infoNote, sectionTitle, selectClass, successNote } from '@/components/portal/kit';
import { Link } from '@/i18n/routing';
import { useToast } from '@/context/ToastContext';
import { useViewer } from '@/context/ViewerContext';
import { localApi, useCategories, useVehicles } from '@/hooks/marketingApi';
import { parsePriceCents, validateLocalProduct, type FieldIssue, type Locale, type LocalProductInput } from '@/lib/import/local-product';
import { getLocalizedString } from '@/lib/utils';

type FieldId = 'nameDe' | 'nameEn' | 'sku' | 'price' | 'type' | 'category' | 'fitment';
type Errors = Partial<Record<FieldId, string>>;

const fieldOf = (field: string, locale?: string): FieldId | null => {
  if (field === 'name') return locale === 'de-DE' ? 'nameDe' : 'nameEn';
  return field === 'sku' || field === 'price' || field === 'type' || field === 'category' || field === 'fitment' ? field : null;
};

/** "Add one": a local product from the form. A fitment claim is not published; it waits for Malva (D6). */
export function LocalProductForm() {
  const t = useTranslations('importPage');
  const tp = useTranslations('permissions');
  const locale = useLocale();
  const { storeKey } = useViewer();
  const { toast } = useToast();
  const { mutate } = useSWRConfig();
  const categories = useCategories(storeKey).data?.categories ?? [];
  const vehicleData = useVehicles(storeKey).data;

  const [nameDe, setNameDe] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('Local part');
  const [category, setCategory] = useState('');
  const [brand, setBrand] = useState('');
  const [fitment, setFitment] = useState<string[]>([]);
  const [vehicleText, setVehicleText] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [general, setGeneral] = useState('');
  const [saved, setSaved] = useState<'live' | 'pending' | null>(null);
  const [busy, setBusy] = useState(false);

  const shownVehicles = useMemo(() => (vehicleData?.vehicles ?? []).filter((v) => v.label.toLowerCase().includes(vehicleText.trim().toLowerCase())), [vehicleData, vehicleText]);
  const message = (id: FieldId) => (id === 'sku' ? t('errors.sku') : id === 'nameDe' || id === 'nameEn' ? t('errors.name') : t(`errors.${id}` as 'errors.price'));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || type !== 'Local part') return;
    setSaved(null);
    setGeneral('');
    const priceCents = parsePriceCents(price);
    const input: LocalProductInput = {
      name: { 'de-DE': nameDe.trim(), 'en-US': nameEn.trim() },
      sku: sku.trim().toUpperCase(),
      priceCents: priceCents ?? 0,
      categoryKey: category,
      type,
      ...(brand.trim() ? { brandName: brand.trim() } : {}),
      ...(fitment.length ? { fitment } : {}),
    };
    const issues: FieldIssue[] = validateLocalProduct(input, { languages: ['de-DE', 'en-US'] as Locale[], categoryKeys: new Set(categories.map((c) => c.key)) });
    const next: Errors = {};
    for (const issue of issues) {
      const id = fieldOf(issue.field, issue.locale);
      if (id) next[id] = message(id);
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    const result = await localApi.create(storeKey, input);
    setBusy(false);
    if (!result.ok || !result.data) {
      if (result.status === 403) return setGeneral(tp('insufficient'));
      const details = result.details ?? {};
      if (details.field === 'sku' && (result.status === 409 || result.code === 'SKU_IN_USE')) return setErrors({ sku: t('errors.skuInUse') });
      const issue = Array.isArray(details.issues) ? (details.issues[0] as { field?: string; locale?: string } | undefined) : undefined;
      const id = fieldOf(typeof details.field === 'string' ? details.field : (issue?.field ?? ''), issue?.locale);
      return id ? setErrors({ [id]: message(id) }) : setGeneral(t('errors.generic'));
    }
    setErrors({});
    setSaved(result.data.status);
    toast(result.data.status === 'live' ? t('form.live') : t('form.pending'));
    setNameDe('');
    setNameEn('');
    setSku('');
    setPrice('');
    setBrand('');
    setFitment([]);
    await mutate((key) => typeof key === 'string' && key.startsWith('/api/seller/local-products'));
  }

  const fieldError = (id: FieldId) => (errors[id] ? <p id={`${id}-error`} role="alert" className="text-caption-1 font-semibold text-text-critical">{errors[id]}</p> : null);
  const describe = (id: FieldId) => (errors[id] ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {});

  return (
    <form onSubmit={submit} className={`${cardClass} flex flex-col gap-500`} aria-labelledby="local-form-title" noValidate>
      <h2 id="local-form-title" className={sectionTitle}>
        {t('form.title')}
      </h2>
      <div className="grid gap-400 md:grid-cols-2">
        <div className="flex flex-col gap-100">
          <FormField id="lp-name-de" label={t('form.nameDe')}>
            <input id="lp-name-de" className={inputClass} value={nameDe} onChange={(e) => setNameDe(e.target.value)} maxLength={120} {...describe('nameDe')} />
          </FormField>
          {fieldError('nameDe')}
        </div>
        <div className="flex flex-col gap-100">
          <FormField id="lp-name-en" label={t('form.nameEn')}>
            <input id="lp-name-en" className={inputClass} value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={120} {...describe('nameEn')} />
          </FormField>
          {fieldError('nameEn')}
        </div>
        <div className="flex flex-col gap-100">
          <FormField id="lp-sku" label={t('form.sku')} hint={t('form.skuHint')}>
            <input id="lp-sku" className={inputClass} value={sku} onChange={(e) => setSku(e.target.value)} maxLength={40} autoCapitalize="characters" {...describe('sku')} />
          </FormField>
          {fieldError('sku')}
        </div>
        <div className="flex flex-col gap-100">
          <FormField id="lp-price" label={t('form.price')} hint={t('form.priceHint')}>
            <input id="lp-price" className={inputClass} inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} {...describe('price')} />
          </FormField>
          {price.trim() !== '' && parsePriceCents(price) !== null ? <p className={hintClass}>{formatEur(parsePriceCents(price) as number, locale)}</p> : null}
          {fieldError('price')}
        </div>
        <div className="flex flex-col gap-100">
          <FormField id="lp-type" label={t('form.type')}>
            <select id="lp-type" className={selectClass} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="Local part">{t('form.typeLocal')}</option>
              <option value="Bundle">{t('form.typeBundle')}</option>
            </select>
          </FormField>
          {type === 'Bundle' ? (
            <Link href="/bundles" className="text-body-2 font-semibold text-text-info underline focus-visible:outline-2 focus-visible:outline-border-active">
              {t('form.bundleLink')}
            </Link>
          ) : null}
        </div>
        <div className="flex flex-col gap-100">
          <FormField id="lp-category" label={t('form.category')}>
            <select id="lp-category" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)} {...describe('category')}>
              <option value="">{t('form.categoryPlaceholder')}</option>
              {categories.map((c) => (
                <option key={c.key} value={c.key}>
                  {getLocalizedString(c.name, locale) || c.key}
                </option>
              ))}
            </select>
          </FormField>
          {fieldError('category')}
        </div>
        <div className="flex flex-col gap-100">
          <FormField id="lp-brand" label={t('form.brand')}>
            <input id="lp-brand" className={inputClass} value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={80} />
          </FormField>
        </div>
      </div>

      <fieldset className="flex flex-col gap-300">
        <legend className="text-body-2 font-semibold text-text">{t('form.fitment')}</legend>
        <p className={hintClass}>{t('form.fitmentHint')}</p>
        <FormField id="lp-vehicle-search" label={t('form.fitmentSearch')}>
          <input id="lp-vehicle-search" type="search" className={inputClass} value={vehicleText} onChange={(e) => setVehicleText(e.target.value)} />
        </FormField>
        {shownVehicles.length === 0 ? <p className={hintClass}>{t('form.fitmentNone')}</p> : null}
        <ul className="grid max-h-[calc(var(--space-6400)*2)] gap-150 overflow-y-auto sm:grid-cols-2">
          {shownVehicles.map((v) => {
            const id = `veh-${v.fitmentKey}`;
            return (
              <li key={v.fitmentKey} className="flex items-center gap-200">
                <input
                  id={id}
                  type="checkbox"
                  className="size-500 focus-visible:outline-2 focus-visible:outline-border-active"
                  checked={fitment.includes(v.fitmentKey)}
                  onChange={(e) => setFitment((list) => (e.target.checked ? [...list, v.fitmentKey] : list.filter((k) => k !== v.fitmentKey)))}
                />
                <label htmlFor={id} className="text-body-2 text-text">
                  {v.label}
                </label>
              </li>
            );
          })}
        </ul>
        {fieldError('fitment')}
      </fieldset>

      {general ? (
        <p role="alert" className={errorNote}>
          {general}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className={saved === 'live' ? successNote : infoNote}>
          {saved === 'live' ? t('form.live') : t('form.pending')}
        </p>
      ) : null}
      <div>
        <button type="submit" className={buttonPrimary} disabled={busy || type !== 'Local part'}>
          {busy ? t('form.saving') : t('form.save')}
        </button>
      </div>
    </form>
  );
}
