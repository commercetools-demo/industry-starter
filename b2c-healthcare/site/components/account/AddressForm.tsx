'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Checkbox, Input, Select } from '@/components/ui/Inputs';
import {
  ADDRESS_FIELD_ORDER,
  US_STATES,
  validateAddress,
  type AddressField,
  type AddressProblems,
  type AddressWarning,
} from '@/lib/address';
import type { AddressResult, SaveOptions } from '@/hooks/use-addresses';
import type { Address, AddressInput } from '@/lib/types';

export interface AddressFormProps {
  /** Present when editing; absent when adding. */
  initial?: Address;
  /** Saves; resolves with the outcome (the form shows field problems, the warning and failures itself). */
  onSave: (input: AddressInput, options: SaveOptions) => Promise<AddressResult>;
  onCancel: () => void;
  /** Called after a successful save. */
  onSaved: () => void;
}

type Values = Record<AddressField, string>;
const FIELD_ID = (field: AddressField) => `address-${field}`;

const EMPTY: Values = { firstName: '', lastName: '', street: '', street2: '', city: '', state: '', zip: '', phone: '' };

/**
 * Add / edit form. The same `validateAddress` runs here and on the server: inline errors per field, focus moves to
 * the first one, the submit button is busy while the request runs. A state that does not match the ZIP raises a
 * warning (fields named, nearest state offered) and nothing is stored until the patient chooses "Save anyway".
 */
export function AddressForm({ initial, onSave, onCancel, onSaved }: AddressFormProps) {
  const t = useTranslations('account.addresses.form');
  const [values, setValues] = useState<Values>(
    initial
      ? {
          firstName: initial.firstName,
          lastName: initial.lastName,
          street: initial.street,
          street2: initial.street2,
          city: initial.city,
          state: initial.state,
          zip: initial.zip,
          phone: initial.phone,
        }
      : EMPTY,
  );
  const [makeDefault, setMakeDefault] = useState(false);
  const [problems, setProblems] = useState<AddressProblems>({});
  const [warning, setWarning] = useState<AddressWarning | null>(null);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ target: AddressField | 'warning' | 'form'; n: number } | null>(null);
  const warningRef = useRef<HTMLDivElement>(null);
  const formErrorRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.target === 'warning') warningRef.current?.focus();
    else if (focusRequest.target === 'form') formErrorRef.current?.focus();
    else document.getElementById(FIELD_ID(focusRequest.target))?.focus();
  }, [focusRequest]);
  const requestFocus = (target: AddressField | 'warning' | 'form') => setFocusRequest((p) => ({ target, n: (p?.n ?? 0) + 1 }));

  const showProblems = (found: AddressProblems) => {
    setProblems(found);
    setWarning(null);
    setFormError('');
    const first = ADDRESS_FIELD_ORDER.find((field) => found[field]);
    if (first) requestFocus(first);
  };

  async function submit(confirmed: boolean) {
    if (busy) return;
    const checked = validateAddress(values);
    if (!checked.ok) return showProblems(checked.problems);
    setProblems({});
    setFormError('');
    setBusy(true);
    const result = await onSave(checked.value, { makeDefault, confirmed });
    setBusy(false);
    if (result.ok) return onSaved();
    if (result.reason === 'invalid') return showProblems(result.fields);
    if (result.reason === 'needs-confirmation') {
      setWarning(result.warning);
      return requestFocus('warning');
    }
    setWarning(null);
    setFormError(t('saveFailed'));
    requestFocus('form');
  }

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit(false);
  };

  const set = (field: AddressField) => (event: { target: { value: string } }) => {
    setValues((v) => ({ ...v, [field]: event.target.value }));
    // Editing invalidates an earlier warning: the address is checked again on the next save.
    if (warning) setWarning(null);
  };
  const problemText = (field: AddressField): string | undefined => (problems[field] ? t(`problems.${field}${problems[field] === 'invalid' ? 'Invalid' : 'Required'}`) : undefined);

  const warningFields = warning ? (warning.fields.length === 2 ? t('warningFields.both') : t(`warningFields.${warning.fields[0]}`)) : '';

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4" aria-busy={busy || undefined} data-address-form>
      {formError ? (
        <p ref={formErrorRef} tabIndex={-1} role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700">
          {formError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id={FIELD_ID('firstName')} label={t('fields.firstName')} name="firstName" autoComplete="given-name" value={values.firstName} onChange={set('firstName')} error={problemText('firstName')} required />
        <Input id={FIELD_ID('lastName')} label={t('fields.lastName')} name="lastName" autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={problemText('lastName')} required />
      </div>
      <Input id={FIELD_ID('street')} label={t('fields.street')} name="street" autoComplete="address-line1" value={values.street} onChange={set('street')} error={problemText('street')} required />
      <Input id={FIELD_ID('street2')} label={t('fields.street2')} name="street2" autoComplete="address-line2" value={values.street2} onChange={set('street2')} error={problemText('street2')} optional />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_9rem]">
        <Input id={FIELD_ID('city')} label={t('fields.city')} name="city" autoComplete="address-level2" value={values.city} onChange={set('city')} error={problemText('city')} required />
        <Select id={FIELD_ID('state')} label={t('fields.state')} name="state" autoComplete="address-level1" value={values.state} onChange={set('state')} error={problemText('state')} required>
          <option value="">{t('fields.stateChoose')}</option>
          {US_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </Select>
        <Input id={FIELD_ID('zip')} label={t('fields.zip')} name="zip" autoComplete="postal-code" inputMode="numeric" value={values.zip} onChange={set('zip')} error={problemText('zip')} required />
      </div>
      <Input id={FIELD_ID('phone')} label={t('fields.phone')} name="phone" type="tel" autoComplete="tel" inputMode="tel" value={values.phone} onChange={set('phone')} hint={t('hints.phone')} error={problemText('phone')} required />
      <p className="text-sm text-neutral-600">
        {t('country')}: {t('countryValue')}
      </p>
      <Checkbox label={t('makeDefault')} checked={makeDefault || initial?.isDefault === true} disabled={initial?.isDefault === true} onChange={(event) => setMakeDefault(event.target.checked)} />
      {warning ? (
        <div ref={warningRef} tabIndex={-1} role="alert" className="grid gap-1 rounded-md bg-warning-50 px-3.5 py-3 text-sm text-navy-900">
          <p className="font-semibold">{t('warningTitle')}</p>
          <p>{t('warning', { fields: warningFields, zip: values.zip, nearest: warning.nearestState })}</p>
        </div>
      ) : null}
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="outline" onClick={onCancel}>
          {t('cancel')}
        </Button>
        {warning ? (
          <Button type="button" busy={busy} onClick={() => void submit(true)}>
            {t('saveAnyway')}
          </Button>
        ) : (
          <Button type="submit" busy={busy}>
            {t('save')}
          </Button>
        )}
      </div>
    </form>
  );
}
