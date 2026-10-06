'use client';

import { useState, type FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Input, Select } from '@/components/ui/Field';
import { useAddressMutations } from '@/hooks/useAddresses';
import { ADDRESS_TEXT_FIELDS, validateAddress, type AddressErrors, type AddressField } from '@/lib/address-validation';
import { ApiError } from '@/lib/fetcher';
import type { SavedAddress } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';

type Values = Record<AddressField, string>;
const COUNTRIES = Object.values(COUNTRY_CONFIG);

const initialValues = (address: SavedAddress | undefined, defaultCountry: string): Values => ({
  firstName: address?.firstName ?? '',
  lastName: address?.lastName ?? '',
  streetName: address?.streetName ?? '',
  additionalStreetInfo: address?.additionalStreetInfo ?? '',
  postalCode: address?.postalCode ?? '',
  city: address?.city ?? '',
  country: address?.country ?? defaultCountry,
  phone: address?.phone ?? '',
});

/** Server field errors (`{ field: errorKey }`) narrowed to the keys the form knows. */
function serverErrors(data: unknown): AddressErrors | null {
  const fields = typeof data === 'object' && data !== null ? (data as { fields?: unknown }).fields : undefined;
  if (typeof fields !== 'object' || fields === null) return null;
  const out: AddressErrors = {};
  for (const name of ADDRESS_TEXT_FIELDS) {
    const key = (fields as Record<string, unknown>)[name];
    if (typeof key === 'string') out[name] = key as AddressErrors[AddressField];
  }
  return Object.keys(out).length > 0 ? out : null;
}

function AddressFormFields({ address, onClose }: { address?: SavedAddress; onClose: () => void }) {
  const t = useTranslations('account.addresses');
  const locale = useLocale();
  const { add, update } = useAddressMutations();
  const [values, setValues] = useState<Values>(() => initialValues(address, COUNTRY_CONFIG[locale]?.country ?? COUNTRIES[0].country));
  const [errors, setErrors] = useState<AddressErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bind = (name: AddressField) => ({
    value: values[name],
    onChange: (e: { target: { value: string } }) => setValues((v) => ({ ...v, [name]: e.target.value })),
    error: errors[name] ? t(`errors.${errors[name]}`) : undefined,
  });

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setFormError(null);
    const found = validateAddress(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await (address ? update(address.id, values) : add(values));
      onClose();
    } catch (e) {
      const fromServer = e instanceof ApiError && e.status === 400 ? serverErrors(e.data) : null;
      if (fromServer) setErrors(fromServer);
      else setFormError(t('dialog.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <form noValidate onSubmit={submit} className="grid gap-(--space-3) tablet:grid-cols-2">
      <Input label={t('dialog.firstName')} autoComplete="given-name" {...bind('firstName')} />
      <Input label={t('dialog.lastName')} autoComplete="family-name" {...bind('lastName')} />
      <Input label={t('dialog.street')} autoComplete="address-line1" fieldClassName="tablet:col-span-2" {...bind('streetName')} />
      <Input label={t('dialog.additional')} autoComplete="address-line2" fieldClassName="tablet:col-span-2" {...bind('additionalStreetInfo')} />
      <Input label={t('dialog.postalCode')} autoComplete="postal-code" {...bind('postalCode')} />
      <Input label={t('dialog.city')} autoComplete="address-level2" {...bind('city')} />
      <Select label={t('dialog.country')} autoComplete="country" {...bind('country')}>
        {COUNTRIES.map((c) => (
          <option key={c.country} value={c.country}>
            {c.label}
          </option>
        ))}
      </Select>
      <Input label={t('dialog.phone')} type="tel" autoComplete="tel" {...bind('phone')} />
      {formError ? (
        <p role="alert" className="m-0 text-[14px] text-accent-700 tablet:col-span-2">
          {formError}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-(--space-3) tablet:col-span-2">
        <Button variant="ghost" onClick={onClose}>
          {t('dialog.cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t('dialog.saving') : t('dialog.save')}
        </Button>
      </div>
    </form>
  );
}

/** Add (no `address`) or edit dialog. Validates with the shared rules before saving; server field errors show inline. The form remounts on every open, so it never keeps old input. */
export function AddressDialog({ open, address, onClose }: { open: boolean; address?: SavedAddress; onClose: () => void }) {
  const t = useTranslations('account.addresses');
  return (
    <Dialog open={open} onClose={onClose} title={address ? t('dialog.editTitle') : t('dialog.addTitle')} className="max-h-[90vh] w-[min(560px,100%)] overflow-y-auto">
      <AddressFormFields key={address?.id ?? 'new'} address={address} onClose={onClose} />
    </Dialog>
  );
}
