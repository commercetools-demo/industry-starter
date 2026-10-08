'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Inputs';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAccount } from '@/hooks/use-account';
import { useAddresses } from '@/hooks/use-addresses';
import type { AddressSaveResult } from '@/hooks/use-checkout';
import { ADDRESS_FIELD_ORDER, US_STATES, addressName, newAddressDefaults, validateAddress, type AddressField, type AddressProblems } from '@/lib/address';
import type { Address, AddressInput } from '@/lib/types';

type Values = Record<AddressField, string>;
const FIELD_ID = (field: AddressField) => `checkout-address-${field}`;

const toValues = (a: AddressInput | Address): Values => ({
  firstName: a.firstName,
  lastName: a.lastName,
  street: a.street,
  street2: a.street2,
  city: a.city,
  state: a.state,
  zip: a.zip,
  phone: a.phone,
});

export interface AddressCardProps {
  /** The address on the cart now (null until one is saved). */
  cartAddress: AddressInput | null;
  /** Sets the address on the cart; the server re-reads the cart and answers with the result. */
  onSave: (input: AddressInput) => Promise<AddressSaveResult>;
  /** The platform has no delivery option for the saved address. */
  undeliverable: boolean;
}

/**
 * Delivery address. Prefilled from the cart's address, else the patient's default address (address book), else
 * blank with the account name; always editable. Format validation is the same function the server runs: an inline
 * error per field and focus on the first one. Saving sets the address on the cart; the summary and delivery options
 * update from the cart the server re-reads. The address is not added to the address book here.
 */
export function AddressCard({ cartAddress, onSave, undeliverable }: AddressCardProps) {
  const t = useTranslations('checkout.address');
  const { addresses, defaultAddress, isLoading, error } = useAddresses();
  const { data: account } = useAccount();
  const ready = !isLoading || error !== undefined || addresses !== undefined;

  const initial: Values = cartAddress
    ? toValues(cartAddress)
    : defaultAddress
      ? toValues(defaultAddress)
      : toValues(newAddressDefaults(account ? { firstName: account.firstName, lastName: account.lastName } : null));

  return (
    <Card as="section" aria-labelledby="checkout-address-title" className="grid gap-4" data-checkout-card="address">
      <h2 id="checkout-address-title" className="font-display text-xl font-semibold text-navy-900">
        {t('title')}
      </h2>
      {!ready ? (
        <div aria-busy="true" className="grid gap-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : (
        <AddressFields initial={initial} saved={addresses ?? []} hasDefault={defaultAddress !== null && defaultAddress !== undefined} cartAddress={cartAddress} onSave={onSave} undeliverable={undeliverable} />
      )}
    </Card>
  );
}

function AddressFields({ initial, saved, hasDefault, cartAddress, onSave, undeliverable }: { initial: Values; saved: Address[]; hasDefault: boolean } & AddressCardProps) {
  const t = useTranslations('checkout.address');
  const f = useTranslations('account.addresses.form');
  const [values, setValues] = useState<Values>(initial);
  const [problems, setProblems] = useState<AddressProblems>({});
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<{ field: AddressField; n: number } | null>(null);

  useEffect(() => {
    if (focus) document.getElementById(FIELD_ID(focus.field))?.focus();
  }, [focus]);

  const set = (field: AddressField) => (event: { target: { value: string } }) => setValues((v) => ({ ...v, [field]: event.target.value }));
  const text = (field: AddressField): string | undefined => (problems[field] ? f(`problems.${field}${problems[field] === 'invalid' ? 'Invalid' : 'Required'}`) : undefined);
  const showProblems = (found: AddressProblems) => {
    setProblems(found);
    const first = ADDRESS_FIELD_ORDER.find((field) => found[field]);
    if (first) setFocus((p) => ({ field: first, n: (p?.n ?? 0) + 1 }));
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const checked = validateAddress(values);
    if (!checked.ok) return showProblems(checked.problems);
    setProblems({});
    setFailed(false);
    setBusy(true);
    const result = await onSave(checked.value);
    setBusy(false);
    if (!result.ok && result.reason === 'invalid') showProblems(result.fields);
    else if (!result.ok && result.reason === 'failed') setFailed(true);
  }

  const choose = (id: string) => {
    const address = saved.find((a) => a.id === id);
    if (address) {
      setValues(toValues(address));
      setProblems({});
    }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4" aria-busy={busy || undefined} data-address-form>
      {!hasDefault && saved.length > 0 ? <p className="text-sm text-neutral-600">{t('noDefault')}</p> : null}
      {saved.length > 0 ? (
        <Select label={t('saved')} name="saved-address" autoComplete="off" defaultValue={saved.find((a) => toValues(a).street === initial.street && a.zip === initial.zip)?.id ?? ''} onChange={(event) => choose(event.target.value)}>
          <option value="">{t('savedChoose')}</option>
          {saved.map((a) => (
            <option key={a.id} value={a.id}>
              {`${addressName(a)}, ${a.street}, ${a.city}`}
            </option>
          ))}
        </Select>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input id={FIELD_ID('firstName')} label={f('fields.firstName')} name="firstName" autoComplete="given-name" value={values.firstName} onChange={set('firstName')} error={text('firstName')} required />
        <Input id={FIELD_ID('lastName')} label={f('fields.lastName')} name="lastName" autoComplete="family-name" value={values.lastName} onChange={set('lastName')} error={text('lastName')} required />
      </div>
      <Input id={FIELD_ID('street')} label={f('fields.street')} name="street" autoComplete="address-line1" value={values.street} onChange={set('street')} error={text('street')} required />
      <Input id={FIELD_ID('street2')} label={f('fields.street2')} name="street2" autoComplete="address-line2" value={values.street2} onChange={set('street2')} error={text('street2')} optional />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_9rem]">
        <Input id={FIELD_ID('city')} label={f('fields.city')} name="city" autoComplete="address-level2" value={values.city} onChange={set('city')} error={text('city')} required />
        <Select id={FIELD_ID('state')} label={f('fields.state')} name="state" autoComplete="address-level1" value={values.state} onChange={set('state')} error={text('state')} required>
          <option value="">{f('fields.stateChoose')}</option>
          {US_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </Select>
        <Input id={FIELD_ID('zip')} label={f('fields.zip')} name="zip" autoComplete="postal-code" inputMode="numeric" value={values.zip} onChange={set('zip')} error={text('zip')} required />
      </div>
      <Input id={FIELD_ID('phone')} label={f('fields.phone')} name="phone" type="tel" autoComplete="tel" inputMode="tel" value={values.phone} onChange={set('phone')} hint={f('hints.phone')} error={text('phone')} required />
      {failed ? (
        <p role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700">
          {t('saveFailed')}
        </p>
      ) : null}
      {undeliverable ? (
        <p role="alert" className="rounded-md bg-danger-50 px-3.5 py-2.5 text-sm font-medium text-danger-700" data-undeliverable>
          {t('undeliverable')}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600" role="status" data-address-status>
          {cartAddress && !undeliverable ? t('using', { name: `${cartAddress.firstName} ${cartAddress.lastName}`, city: cartAddress.city, state: cartAddress.state, zip: cartAddress.zip }) : ''}
        </p>
        <Button type="submit" variant="outline" busy={busy}>
          {t('use')}
        </Button>
      </div>
    </form>
  );
}
