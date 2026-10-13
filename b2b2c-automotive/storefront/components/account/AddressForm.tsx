// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState, type FormEvent } from 'react';
import { Notice } from '@/components/account/Panel';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { errorCodeOf } from '@/hooks/account-fetch';
import type { AccountAddress, AddressInput } from '@/lib/types';

interface Props {
  /** The address being edited; absent for a new one. */
  address?: AccountAddress;
  /** Store countries; empty means the store lists none (a two-letter code is typed). */
  countries: string[];
  onSubmit: (input: AddressInput) => Promise<void>;
  onCancel: () => void;
}

const ERRORS = ['country-not-served', 'postal-invalid', 'address-limit'];

/** Add or edit one address: 48 px fields, `autocomplete` tokens, the store's countries, "use as my default" checkbox. The server's refusal is shown in words. */
export function AddressForm({ address, countries, onSubmit, onCancel }: Props) {
  const t = useTranslations('account.addresses');
  const tc = useTranslations('account');
  const locale = useLocale();
  const [form, setForm] = useState({
    firstName: address?.firstName ?? '',
    lastName: address?.lastName ?? '',
    streetName: address?.streetName ?? '',
    streetNumber: address?.streetNumber ?? '',
    postalCode: address?.postalCode ?? '',
    city: address?.city ?? '',
    country: address?.country ?? countries[0] ?? '',
    phone: address?.phone ?? '',
    makeDefault: address?.isDefault ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const set = (key: keyof typeof form) => (event: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: event.target.value }));
  const countryName = (code: string) => new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await onSubmit({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        streetName: form.streetName.trim(),
        ...(form.streetNumber.trim() ? { streetNumber: form.streetNumber.trim() } : {}),
        postalCode: form.postalCode.trim(),
        city: form.city.trim(),
        country: form.country.trim().toUpperCase(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        makeDefault: form.makeDefault,
      });
    } catch (failure) {
      const code = errorCodeOf(failure);
      setError(t(`errors.${ERRORS.includes(code) ? code : 'generic'}` as 'errors.generic'));
      setPending(false);
      errorRef.current?.focus();
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4" aria-label={address ? t('formTitleEdit') : t('formTitleAdd')}>
      <h3 className="m-0 font-display text-md font-semibold text-text">{address ? t('formTitleEdit') : t('formTitleAdd')}</h3>
      <div className="grid gap-4 min-[43.75rem]:grid-cols-2">
        <Field label={t('firstName')} name="given-name" autoComplete="given-name" required value={form.firstName} onChange={set('firstName')} />
        <Field label={t('lastName')} name="family-name" autoComplete="family-name" required value={form.lastName} onChange={set('lastName')} />
        <Field label={t('street')} name="street" autoComplete="address-line1" required value={form.streetName} onChange={set('streetName')} />
        <Field label={t('streetNumber')} name="streetNumber" autoComplete="off" value={form.streetNumber} onChange={set('streetNumber')} />
        <Field label={t('postalCode')} name="postal-code" autoComplete="postal-code" required value={form.postalCode} onChange={set('postalCode')} />
        <Field label={t('city')} name="city" autoComplete="address-level2" required value={form.city} onChange={set('city')} />
        {countries.length > 0 ? (
          <Select label={t('country')} name="country" autoComplete="country" required value={form.country} onChange={set('country')}>
            {countries.map((code) => (
              <option key={code} value={code}>
                {countryName(code)}
              </option>
            ))}
          </Select>
        ) : (
          <Field label={t('country')} name="country" autoComplete="country" required maxLength={2} value={form.country} onChange={set('country')} />
        )}
        <Field label={t('phone')} name="tel" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
      </div>
      <label className="flex min-h-7 items-center gap-3 font-ui text-sm text-text">
        <input type="checkbox" checked={form.makeDefault} onChange={(e) => setForm((f) => ({ ...f, makeDefault: e.target.checked }))} className="size-5 accent-action" />
        {t('defaultCheckbox')}
      </label>
      <div ref={errorRef} tabIndex={-1}>
        <Notice tone="error">{error}</Notice>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? tc('saving') : tc('save')}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          {tc('cancel')}
        </Button>
      </div>
    </form>
  );
}
