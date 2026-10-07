'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Field, Input, Select } from '@/components/ui/Field';
import { US_STATES } from '@/lib/addresses/zip-table';
import type { AddressField, AddressFieldError, CheckoutAddress } from '@/lib/types';

export type AddressValues = {
  firstName: string;
  lastName: string;
  streetName: string;
  additionalStreetInfo: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
};

export type AddressErrors = Partial<Record<AddressField, AddressFieldError>>;

export const emptyValues = (): AddressValues => ({ firstName: '', lastName: '', streetName: '', additionalStreetInfo: '', city: '', state: '', postalCode: '', phone: '' });

export const valuesOf = (address: CheckoutAddress | null): AddressValues =>
  address
    ? { firstName: address.firstName, lastName: address.lastName, streetName: address.streetName, additionalStreetInfo: address.additionalStreetInfo ?? '', city: address.city, state: address.state ?? '', postalCode: address.postalCode, phone: address.phone ?? '' }
    : emptyValues();

/** The address the checkout stores: trimmed, optional fields only when filled, the country always the market's. */
export function toCheckoutAddress(values: AddressValues, country: 'US' | 'DE'): CheckoutAddress {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    streetName: values.streetName.trim(),
    ...(values.additionalStreetInfo.trim() ? { additionalStreetInfo: values.additionalStreetInfo.trim() } : {}),
    city: values.city.trim(),
    ...(country === 'US' && values.state ? { state: values.state } : {}),
    postalCode: values.postalCode.trim(),
    country,
    ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
  };
}

type Props = {
  idPrefix: string;
  values: AddressValues;
  errors: AddressErrors;
  country: 'US' | 'DE';
  onChange: (values: AddressValues) => void;
};

/** The address form of the checkout. The country is the market's (the store ships to its own country only), so it is text, not a field. */
export function AddressFields({ idPrefix, values, errors, country, onChange }: Props): ReactElement {
  const t = useTranslations('account.addresses');
  const c = useTranslations('checkout.address');
  const set = (name: keyof AddressValues, value: string): void => onChange({ ...values, [name]: value });
  const error = (name: AddressField): string | undefined => (errors[name] ? t(`errors.${errors[name]}`) : undefined);
  const text = (name: keyof AddressValues, field: AddressField, autoComplete: string) => (
    <Field label={t(`fields.${field}`)} htmlFor={`${idPrefix}-${name}`} {...(error(field) ? { error: error(field) as string } : {})}>
      <Input id={`${idPrefix}-${name}`} value={values[name]} autoComplete={autoComplete} onChange={(event) => set(name, event.target.value)} />
    </Field>
  );
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {text('firstName', 'firstName', 'given-name')}
      {text('lastName', 'lastName', 'family-name')}
      <div className="sm:col-span-2">{text('streetName', 'streetName', 'address-line1')}</div>
      <div className="sm:col-span-2">{text('additionalStreetInfo', 'additionalStreetInfo' as AddressField, 'address-line2')}</div>
      {text('city', 'city', 'address-level2')}
      {country === 'US' ? (
        <Field label={t('fields.state')} htmlFor={`${idPrefix}-state`} {...(error('state') ? { error: error('state') as string } : {})}>
          <Select id={`${idPrefix}-state`} value={values.state} autoComplete="address-level1" onChange={(event) => set('state', event.target.value)}>
            <option value="">{t('dialog.selectState')}</option>
            {US_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      {text('postalCode', 'postalCode', 'postal-code')}
      {text('phone', 'phone', 'tel')}
      <p className="m-0 self-end text-sm text-text-muted sm:col-span-2">{c('country', { country: t(`countries.${country}`) })}</p>
    </div>
  );
}
