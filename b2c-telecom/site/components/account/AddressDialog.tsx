'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Field';
import { AccountApiError } from '@/hooks/accountRequest';
import { useAddressMutations, type SaveOptions } from '@/hooks/useAddresses';
import type { ResolveResult } from '@/lib/addresses/resolver';
import { validateAddress } from '@/lib/addresses/validate';
import { US_STATES } from '@/lib/addresses/zip-table';
import { ADDRESS_BOOK_LIMIT } from '@/lib/config/addresses';
import type { AddressField, AddressFieldError, AddressInput, SavedAddress } from '@/lib/types';

type Values = {
  firstName: string;
  lastName: string;
  streetName: string;
  additionalStreetInfo: string;
  city: string;
  state: string;
  postalCode: string;
  country: 'US' | 'DE';
  phone: string;
};
type Errors = Partial<Record<AddressField, AddressFieldError>>;
type Step = { kind: 'form' } | { kind: 'verify'; resolve: ResolveResult };

export interface AddressDialogProps {
  /** `null` = add; an address = edit. */
  editing: SavedAddress | null;
  /** The book is empty: "Make this my default" starts checked. */
  isFirst: boolean;
  /** The country the store sells in; the add form starts with it. */
  defaultCountry: 'US' | 'DE';
  onClose: () => void;
}

const toValues = (address: SavedAddress | null, country: 'US' | 'DE'): Values => ({
  firstName: address?.firstName ?? '',
  lastName: address?.lastName ?? '',
  streetName: address?.streetName ?? '',
  additionalStreetInfo: address?.additionalStreetInfo ?? '',
  city: address?.city ?? '',
  state: address?.state ?? '',
  postalCode: address?.postalCode ?? '',
  country: address?.country ?? country,
  phone: address?.phone ?? '',
});

const toInput = (values: Values, isService: boolean, isBilling: boolean): AddressInput => ({
  firstName: values.firstName.trim(),
  lastName: values.lastName.trim(),
  streetName: values.streetName.trim(),
  ...(values.additionalStreetInfo.trim() ? { additionalStreetInfo: values.additionalStreetInfo.trim() } : {}),
  city: values.city.trim(),
  ...(values.country === 'US' && values.state ? { state: values.state } : {}),
  postalCode: values.postalCode.trim(),
  country: values.country,
  ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
  isService,
  isBilling,
});

const CHECKBOX = 'size-5 shrink-0 accent-action';

/**
 * Add or edit one address in a native `<dialog>` (focus trap, Escape, focus returns to the opener). Order of a save: format check in the
 * browser (nothing is sent when it fails) -> the server's resolver verdict -> only then the write. An address the resolver cannot verify
 * shows the "We couldn't verify this address" panel; nothing is stored until the buyer picks "Use suggested address" or "Keep what I typed".
 */
export function AddressDialog({ editing, isFirst, defaultCountry, onClose }: AddressDialogProps): ReactElement {
  const t = useTranslations('account.addresses');
  const { add, update, validate } = useAddressMutations();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [values, setValues] = useState<Values>(() => toValues(editing, defaultCountry));
  const [isService, setIsService] = useState(editing?.isService ?? true);
  const [isBilling, setIsBilling] = useState(editing?.isBilling ?? true);
  const [makeDefault, setMakeDefault] = useState(isFirst);
  const [errors, setErrors] = useState<Errors>({});
  const [purposeError, setPurposeError] = useState(false);
  const [step, setStep] = useState<Step>({ kind: 'form' });
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }, []);

  const close = (): void => {
    const dialog = ref.current;
    if (dialog && typeof dialog.close === 'function' && dialog.open) dialog.close();
    onClose();
  };

  const set = <K extends keyof Values>(name: K, value: Values[K]): void => {
    setValues((current) => ({ ...current, [name]: value }));
    if (name in errors) setErrors((current) => ({ ...current, [name]: undefined }));
  };

  async function save(input: AddressInput, confirmed: boolean): Promise<void> {
    setSaving(true);
    setFailure(null);
    const options: SaveOptions = { ...(confirmed ? { confirmed: true } : {}) };
    try {
      if (editing) await update(editing.id, input, options);
      else await add(input, { ...options, makeDefaultService: makeDefault && input.isService, makeDefaultBilling: makeDefault && input.isBilling });
      close();
    } catch (error) {
      setSaving(false);
      if (error instanceof AccountApiError && error.code === 'INVALID_ADDRESS') {
        setErrors((error.details?.fields ?? {}) as Errors);
        setStep({ kind: 'form' });
      } else if (error instanceof AccountApiError && error.code === 'ADDRESS_LIMIT') setFailure(t('errors.limit', { max: ADDRESS_BOOK_LIMIT }));
      else setFailure(t('errors.generic'));
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const input = toInput(values, isService, isBilling);
    const found = validateAddress(input);
    const noPurpose = !isService && !isBilling;
    setErrors(found);
    setPurposeError(noPurpose);
    if (Object.keys(found).length > 0 || noPurpose) return; // nothing is sent
    setSaving(true);
    setFailure(null);
    try {
      const verdict = await validate(input);
      if (Object.keys(verdict.fields).length > 0) {
        setErrors(verdict.fields);
        setSaving(false);
        return;
      }
      if (verdict.resolve?.status === 'unresolved') {
        setStep({ kind: 'verify', resolve: verdict.resolve });
        setSaving(false);
        return;
      }
    } catch {
      setFailure(t('errors.generic'));
      setSaving(false);
      return;
    }
    await save(input, false);
  }

  async function applySuggested(resolve: ResolveResult): Promise<void> {
    const match = resolve.nearestMatch;
    if (!match) return;
    const next: Values = { ...values, city: match.city, state: match.state ?? '', postalCode: match.postalCode };
    setValues(next);
    await save(toInput(next, isService, isBilling), true);
  }

  const errorText = (name: AddressField): string | undefined => {
    const code = errors[name];
    return code ? t(`errors.${code}`) : undefined;
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto max-h-screen w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-surface p-7 text-text backdrop:bg-overlay"
    >
      {step.kind === 'verify' ? (
        <div className="flex flex-col gap-5">
          <h2 id={titleId} className="m-0 font-display text-2xl font-bold">
            {t('verify.title')}
          </h2>
          <p className="m-0 text-md">{t('verify.check', { fields: step.resolve.unresolvedFields.map((field) => t(`fields.${field}`)).join(', ') })}</p>
          {step.resolve.nearestMatch ? (
            <div>
              <p className="m-0 font-display text-sm font-semibold uppercase tracking-ui text-text-muted">{t('verify.suggested')}</p>
              <address className="m-0 flex flex-col text-md not-italic">
                <span>{values.streetName}</span>
                <span>{[step.resolve.nearestMatch.city, [step.resolve.nearestMatch.state, step.resolve.nearestMatch.postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', ')}</span>
              </address>
            </div>
          ) : null}
          {failure ? <p className="m-0 text-sm text-danger">{failure}</p> : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={() => setStep({ kind: 'form' })} disabled={saving}>
              {t('verify.edit')}
            </Button>
            <Button variant="secondary" onClick={() => void save(toInput(values, isService, isBilling), true)} disabled={saving}>
              {t('verify.keep')}
            </Button>
            {step.resolve.nearestMatch ? (
              <Button onClick={() => void applySuggested(step.resolve)} loading={saving} disabled={saving}>
                {t('verify.useSuggested')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-5">
          <h2 id={titleId} className="m-0 font-display text-2xl font-bold">
            {editing ? t('dialog.editTitle') : t('dialog.addTitle')}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('fields.firstName')} error={errorText('firstName')}>
              <Input value={values.firstName} onChange={(event) => set('firstName', event.target.value)} autoComplete="given-name" />
            </Field>
            <Field label={t('fields.lastName')} error={errorText('lastName')}>
              <Input value={values.lastName} onChange={(event) => set('lastName', event.target.value)} autoComplete="family-name" />
            </Field>
          </div>
          <Field label={t('fields.streetName')} error={errorText('streetName')}>
            <Input value={values.streetName} onChange={(event) => set('streetName', event.target.value)} autoComplete="address-line1" />
          </Field>
          <Field label={t('fields.additionalStreetInfo')}>
            <Input value={values.additionalStreetInfo} onChange={(event) => set('additionalStreetInfo', event.target.value)} autoComplete="address-line2" />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('fields.city')} error={errorText('city')}>
              <Input value={values.city} onChange={(event) => set('city', event.target.value)} autoComplete="address-level2" />
            </Field>
            {values.country === 'US' ? (
              <Field label={t('fields.state')} error={errorText('state')}>
                <Select value={values.state} onChange={(event) => set('state', event.target.value)} autoComplete="address-level1">
                  <option value="">{t('dialog.selectState')}</option>
                  {US_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={t('fields.postalCode')} error={errorText('postalCode')}>
              <Input value={values.postalCode} onChange={(event) => set('postalCode', event.target.value)} autoComplete="postal-code" inputMode="text" />
            </Field>
            <Field label={t('fields.country')} error={errorText('country')}>
              <Select
                value={values.country}
                onChange={(event) => {
                  setValues((current) => ({ ...current, country: event.target.value === 'DE' ? 'DE' : 'US', state: '' }));
                  setErrors((current) => ({ ...current, country: undefined, state: undefined, postalCode: undefined }));
                }}
                autoComplete="country"
              >
                <option value="US">{t('countries.US')}</option>
                <option value="DE">{t('countries.DE')}</option>
              </Select>
            </Field>
          </div>
          <Field label={t('fields.phone')} error={errorText('phone')}>
            <Input type="tel" value={values.phone} onChange={(event) => set('phone', event.target.value)} autoComplete="tel" />
          </Field>
          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <label className="flex items-center gap-3 text-md">
              <input type="checkbox" className={CHECKBOX} checked={isService} onChange={(event) => { setIsService(event.target.checked); setPurposeError(false); }} />
              {t('dialog.useService')}
            </label>
            <label className="flex items-center gap-3 text-md">
              <input type="checkbox" className={CHECKBOX} checked={isBilling} onChange={(event) => { setIsBilling(event.target.checked); setPurposeError(false); }} />
              {t('dialog.useBilling')}
            </label>
            {editing ? null : (
              <label className="flex items-center gap-3 text-md">
                <input type="checkbox" className={CHECKBOX} checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />
                {t('dialog.makeDefault')}
              </label>
            )}
            {purposeError ? <p className="m-0 text-sm text-danger">{t('errors.purpose')}</p> : null}
          </fieldset>
          {failure ? (
            <p role="alert" className="m-0 text-sm text-danger">
              {failure}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="ghost" onClick={close}>
              {t('dialog.cancel')}
            </Button>
            <Button type="submit" loading={saving} disabled={saving}>
              {saving ? t('dialog.saving') : t('dialog.save')}
            </Button>
          </div>
        </form>
      )}
    </dialog>
  );
}
