'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { ADDRESS_COUNTRIES, US_STATES, validateAddress } from '@/lib/account/address-validate';
import { marketForLocale } from '@/lib/utils';
import type { AddressInput, AppAddress } from '@/lib/types';

/** DOM order of the fields: the first invalid one gets the focus. */
const ORDER = ['label', 'firstName', 'lastName', 'streetName', 'additionalStreetInfo', 'city', 'state', 'postalCode', 'country', 'phone'] as const;

const toInput = (a: AppAddress | null, country: string): AddressInput => ({
  label: a?.label ?? '',
  firstName: a?.firstName ?? '',
  lastName: a?.lastName ?? '',
  streetName: a?.streetName ?? '',
  additionalStreetInfo: a?.additionalStreetInfo ?? '',
  city: a?.city ?? '',
  state: a?.state ?? '',
  postalCode: a?.postalCode ?? '',
  country: a?.country ?? country,
  phone: a?.phone ?? '',
});

export interface AddressFormProps {
  /** The address being edited, or null for a new one. */
  address: AppAddress | null;
  /** Field errors that came back from the server (code per field). */
  serverFields?: Record<string, string>;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (address: AddressInput, makeDefault: boolean) => void;
  /** Initial values after "Edit" in the verify dialog. */
  draft?: AddressInput | null;
}

/**
 * Add and edit form. The same pure `validateAddress` the server uses runs first, so a bad value is reported beside its
 * field and the first invalid field takes the focus. The State field exists for the US only.
 */
export default function AddressForm({ address, serverFields, pending, onCancel, onSubmit, draft }: AddressFormProps) {
  const t = useTranslations('account.addresses');
  const locale = useLocale();
  const market = marketForLocale(locale);
  const [values, setValues] = useState<AddressInput>(() => draft ?? toInput(address, market.country));
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const shown = { ...serverFields, ...errors };

  const set = (key: keyof AddressInput, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };
  const focusFirst = (fields: Record<string, string>) => {
    const first = ORDER.find((k) => fields[k]);
    if (first) formRef.current?.querySelector<HTMLElement>(`#addr-${first}`)?.focus();
  };

  const submit = () => {
    const checked = validateAddress(values);
    if (!checked.ok) {
      setErrors(checked.fields);
      focusFirst(checked.fields);
      return;
    }
    setErrors({});
    onSubmit(checked.address, makeDefault);
  };

  const err = (key: string) => (shown[key] ? t(`form.error.${shown[key]}` as 'form.error.invalid') : undefined);
  const us = values.country === 'US';
  const props = (key: keyof AddressInput) => ({
    id: `addr-${key}`,
    value: (values[key] as string | undefined) ?? '',
    invalid: Boolean(shown[key]),
    'aria-describedby': shown[key] ? `addr-${key}-error` : undefined,
    onChange: (e: { target: { value: string } }) => set(key, e.target.value),
  });

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <Field label={t('label')} htmlFor="addr-label" error={err('label')}>
        <Input {...props('label')} maxLength={40} autoComplete="off" />
      </Field>
      <div className="grid gap-x-4 xs:grid-cols-2">
        <Field label={t('form.firstName')} htmlFor="addr-firstName" error={err('firstName')}>
          <Input {...props('firstName')} autoComplete="given-name" />
        </Field>
        <Field label={t('form.lastName')} htmlFor="addr-lastName" error={err('lastName')}>
          <Input {...props('lastName')} autoComplete="family-name" />
        </Field>
      </div>
      <Field label={t('form.street')} htmlFor="addr-streetName" error={err('streetName')}>
        <Input {...props('streetName')} autoComplete="address-line1" />
      </Field>
      <Field label={t('form.street2')} htmlFor="addr-additionalStreetInfo" error={err('additionalStreetInfo')}>
        <Input {...props('additionalStreetInfo')} autoComplete="address-line2" />
      </Field>
      <div className="grid gap-x-4 xs:grid-cols-2">
        <Field label={t('form.city')} htmlFor="addr-city" error={err('city')}>
          <Input {...props('city')} autoComplete="address-level2" />
        </Field>
        {us ? (
          <Field label={t('form.state')} htmlFor="addr-state" error={err('state')}>
            <Select {...props('state')} autoComplete="address-level1">
              <option value="">{t('form.statePlaceholder')}</option>
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}
        <Field label={us ? t('form.postalCode') : t('form.postalCodeCA')} htmlFor="addr-postalCode" error={err('postalCode')}>
          <Input {...props('postalCode')} autoComplete="postal-code" />
        </Field>
        <Field label={t('form.country')} htmlFor="addr-country" error={err('country')}>
          <Select {...props('country')} autoComplete="country">
            {ADDRESS_COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {t(`form.countries.${c}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label={t('form.phone')} htmlFor="addr-phone" error={err('phone')}>
        <Input {...props('phone')} type="tel" autoComplete="tel" />
      </Field>
      <label className="mb-5 flex min-h-11 cursor-pointer items-center gap-3 text-[14px] text-ink">
        <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} className="h-5 w-5 accent-accent" />
        {t('form.makeDefault')}
      </label>
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="ghost" onClick={onCancel}>
          {t('form.cancel')}
        </Button>
        <Button type="submit" loading={pending}>
          {t('form.save')}
        </Button>
      </div>
    </form>
  );
}
