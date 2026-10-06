'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';
import type { AddressInput, DeliveryResult } from '@/hooks/useDelivery';
import { isValidPostalCode } from '@/lib/slots/deliverable';
import type { Address } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';

type FieldName = 'firstName' | 'lastName' | 'streetName' | 'postalCode' | 'city' | 'country';
type Values = Record<FieldName | 'additionalStreetInfo' | 'phone', string>;
const REQUIRED: FieldName[] = ['firstName', 'lastName', 'streetName', 'postalCode', 'city'];
const COUNTRIES = Object.values(COUNTRY_CONFIG);

const initialValues = (address: Address | undefined, defaultCountry: string): Values => ({
  firstName: address?.firstName ?? '',
  lastName: address?.lastName ?? '',
  streetName: address?.streetName ?? '',
  additionalStreetInfo: address?.additionalStreetInfo ?? '',
  postalCode: address?.postalCode ?? '',
  city: address?.city ?? '',
  country: address?.country ?? defaultCountry,
  phone: address?.phone ?? '',
});

/** Delivery address form. Validates required fields and the postcode shape before calling `onSave`; shows server answers inline. */
export function AddressForm({
  address,
  onSave,
}: {
  address?: Address;
  onSave: (address: AddressInput) => Promise<DeliveryResult>;
}) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const [values, setValues] = useState<Values>(() => initialValues(address, COUNTRY_CONFIG[locale]?.country ?? COUNTRIES[0].country));
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (name: keyof Values) => (value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    setSaved(false);
  };
  const bind = (name: keyof Values) => ({ value: values[name], onChange: (e: { target: { value: string } }) => set(name)(e.target.value) });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: Partial<Record<FieldName, string>> = {};
    for (const name of REQUIRED) if (values[name].trim() === '') next[name] = t('step.required');
    if (!next.postalCode && !isValidPostalCode(values.country, values.postalCode)) next.postalCode = t('step.invalidPostcode');
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    const result = await onSave({
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      streetName: values.streetName.trim(),
      postalCode: values.postalCode.trim(),
      city: values.city.trim(),
      country: values.country,
      ...(values.additionalStreetInfo.trim() ? { additionalStreetInfo: values.additionalStreetInfo.trim() } : {}),
      ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
    });
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      return;
    }
    switch (result.error) {
      case 'UNDELIVERABLE':
        setErrors({ postalCode: t('step.undeliverable') });
        break;
      case 'COUNTRY_MISMATCH':
        setErrors({ country: t('step.countryMismatch') });
        break;
      case 'INVALID_ADDRESS':
        setErrors(Object.fromEntries((result.fields ?? []).map((f) => [f, f === 'postalCode' ? t('step.invalidPostcode') : t('step.required')])));
        break;
      case 'SHIPPING_UNAVAILABLE':
        setFormError(t('step.shippingUnavailable'));
        break;
      default:
        setFormError(t('step.saveFailed'));
    }
  };

  return (
    <form noValidate onSubmit={submit} aria-label={t('step.addressLegend')} className="grid gap-(--space-3) tablet:grid-cols-2">
      <Input label={t('step.firstName')} autoComplete="given-name" error={errors.firstName} {...bind('firstName')} />
      <Input label={t('step.lastName')} autoComplete="family-name" error={errors.lastName} {...bind('lastName')} />
      <Input label={t('step.street')} autoComplete="address-line1" error={errors.streetName} fieldClassName="tablet:col-span-2" {...bind('streetName')} />
      <Input label={t('step.additional')} autoComplete="address-line2" fieldClassName="tablet:col-span-2" {...bind('additionalStreetInfo')} />
      <Input label={t('step.postalCode')} autoComplete="postal-code" inputMode="text" error={errors.postalCode} {...bind('postalCode')} />
      <Input label={t('step.city')} autoComplete="address-level2" error={errors.city} {...bind('city')} />
      <Select label={t('step.country')} autoComplete="country" error={errors.country} {...bind('country')}>
        {COUNTRIES.map((c) => (
          <option key={c.country} value={c.country}>
            {c.label}
          </option>
        ))}
      </Select>
      <Input label={t('step.phone')} type="tel" autoComplete="tel" {...bind('phone')} />
      <div className="flex flex-wrap items-center gap-(--space-3) tablet:col-span-2">
        <Button type="submit" disabled={saving}>
          {saving ? t('step.saving') : t('step.save')}
        </Button>
        {saved ? (
          <span role="status" className="text-[14px] text-muted">
            {t('step.saved')}
          </span>
        ) : null}
        {formError ? (
          <span role="alert" className="text-[14px] text-accent-700">
            {formError}
          </span>
        ) : null}
      </div>
    </form>
  );
}
