'use client';

import { useId, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { CheckoutError } from '@/hooks/useCheckout';
import { useAddresses } from '@/hooks/useAddresses';
import { validateAddress } from '@/lib/addresses/validate';
import { pickPreselected } from '@/lib/addresses/select';
import { Link } from '@/i18n/routing';
import { FOCUS_RING } from '@/components/ui/focus';
import { cx } from '@/lib/cx';
import type { AddressField, AddressFieldError, CheckoutAddress, SavedAddress } from '@/lib/types';
import { AddressFields, toCheckoutAddress, valuesOf, type AddressErrors, type AddressValues } from './AddressFields';
import type { CheckoutApi } from './types';
import { useCheckoutErrorText } from './useCheckoutError';

type Props = { checkout: CheckoutApi; phone: string; onDone: () => void };

const country = (locale: string): 'US' | 'DE' => (locale.startsWith('de') ? 'DE' : 'US');
const CHECKBOX = 'size-5 shrink-0 accent-action';

const fromSaved = (address: SavedAddress): CheckoutAddress => ({
  firstName: address.firstName,
  lastName: address.lastName,
  streetName: address.streetName,
  ...(address.additionalStreetInfo ? { additionalStreetInfo: address.additionalStreetInfo } : {}),
  city: address.city,
  ...(address.state ? { state: address.state } : {}),
  postalCode: address.postalCode,
  country: address.country,
  ...(address.phone ? { phone: address.phone } : {}),
});

function validate(values: AddressValues, marketCountry: 'US' | 'DE'): AddressErrors {
  return validateAddress({ ...toCheckoutAddress(values, marketCountry), isService: true, isBilling: false }) as Partial<Record<AddressField, AddressFieldError>>;
}

/**
 * Step 2. A signed-in buyer with saved service addresses of this market chooses one (only the DEFAULT is preselected; none when there is no
 * default, T's `pickPreselected`) or types a different one. After "Continue" the server's serviceability answer (K) decides: an address no
 * line can be served at is stored, the buyer is told which items, and offered "Change address" and "Edit My bundle".
 */
export function ServiceAddressStep({ checkout, phone, onDone }: Props): ReactElement {
  const t = useTranslations('checkout');
  const locale = useLocale();
  const marketCountry = country(locale);
  const errorText = useCheckoutErrorText();
  const groupId = useId();
  const { state } = checkout;
  const { addresses } = useAddresses({ enabled: state.signedIn });
  const saved = useMemo(() => addresses.filter((address) => address.isService && address.country === marketCountry), [addresses, marketCountry]);

  // `undefined` = the buyer has not touched the choice: the derived default applies.
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const [useOther, setUseOther] = useState(false);
  const derived = saved.find((address) => address.id === pickPreselected(saved)?.id)?.id ?? null;
  const selectedId = choice === undefined ? derived : choice;
  const showForm = useOther || saved.length === 0;

  const [values, setValues] = useState<AddressValues>(() => ({ ...valuesOf(state.serviceAddress), ...(phone && !state.serviceAddress?.phone ? { phone } : {}) }));
  const [billingSame, setBillingSame] = useState(true);
  const [billing, setBilling] = useState<AddressValues>(() => valuesOf(state.billingAddress));
  const [errors, setErrors] = useState<AddressErrors>({});
  const [billingErrors, setBillingErrors] = useState<AddressErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ names: string } | null>(null);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    setFailure(null);
    let service: CheckoutAddress;
    if (showForm) {
      const found = validate(values, marketCountry);
      setErrors(found);
      const foundBilling = billingSame ? {} : validate(billing, marketCountry);
      setBillingErrors(foundBilling);
      if (Object.keys(found).length > 0 || Object.keys(foundBilling).length > 0) return; // nothing is sent
      service = toCheckoutAddress(values, marketCountry);
    } else {
      const chosen = saved.find((address) => address.id === selectedId);
      if (!chosen) return;
      service = fromSaved(chosen);
    }
    if (!service.phone && phone.trim()) service = { ...service, phone: phone.trim() };
    setBusy(true);
    try {
      await checkout.saveDetails({ serviceAddress: service, ...(billingSame ? {} : { billingAddress: toCheckoutAddress(billing, marketCountry) }) });
      onDone();
    } catch (error) {
      if (error instanceof CheckoutError && error.code === 'NOT_SERVICEABLE') {
        const ids = Array.isArray(error.details?.lineIds) ? (error.details.lineIds as string[]) : [];
        const cart = error.state?.cart ?? state.cart;
        const names = cart.lines.filter((line) => ids.includes(line.id)).map((line) => line.name);
        setBlocked({ names: (names.length > 0 ? names : cart.lines.filter((line) => line.kind === 'plan').map((line) => line.name)).join(', ') });
      } else if (error instanceof CheckoutError && error.code === 'INVALID_ADDRESS') {
        setErrors((error.details?.fields ?? {}) as AddressErrors);
      } else {
        setFailure(errorText(error));
      }
    } finally {
      setBusy(false);
    }
  }

  const canContinue = !blocked && (showForm || selectedId !== null);

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6" aria-labelledby="checkout-address">
      <h2 id="checkout-address" className="m-0 font-display text-2xl font-bold tracking-ui">
        {t('address.heading')}
      </h2>

      {!showForm ? (
        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="mb-3 font-display text-sm font-semibold">{t('address.choose')}</legend>
          {saved.map((address) => (
            <label key={address.id} className={cx('flex cursor-pointer items-start gap-4 rounded-xl border p-5', selectedId === address.id ? 'border-action bg-pink-50' : 'border-border bg-surface')}>
              <input type="radio" name={groupId} className={CHECKBOX} checked={selectedId === address.id} onChange={() => setChoice(address.id)} />
              <span className="flex flex-col text-md">
                <span className="font-semibold">
                  {address.firstName} {address.lastName}
                </span>
                <span>
                  {address.streetName}
                  {address.additionalStreetInfo ? `, ${address.additionalStreetInfo}` : ''}
                </span>
                <span>
                  {address.city}
                  {address.state ? `, ${address.state}` : ''} {address.postalCode}
                </span>
              </span>
            </label>
          ))}
          <div>
            <Button variant="ghost" onClick={() => setUseOther(true)}>
              {t('address.useOther')}
            </Button>
          </div>
        </fieldset>
      ) : (
        <>
          <AddressFields idPrefix="service" values={values} errors={errors} country={marketCountry} onChange={setValues} />
          {saved.length > 0 ? (
            <div>
              <Button variant="ghost" onClick={() => setUseOther(false)}>
                {t('address.useSaved')}
              </Button>
            </div>
          ) : null}
        </>
      )}

      <label className="flex items-center gap-4 text-md">
        <input type="checkbox" className={CHECKBOX} checked={billingSame} onChange={(event) => setBillingSame(event.target.checked)} />
        {t('address.billingSame')}
      </label>
      {!billingSame ? (
        <section aria-labelledby="checkout-billing" className="flex flex-col gap-4">
          <h3 id="checkout-billing" className="m-0 font-display text-lg font-bold">
            {t('address.billingHeading')}
          </h3>
          <AddressFields idPrefix="billing" values={billing} errors={billingErrors} country={marketCountry} onChange={setBilling} />
        </section>
      ) : null}

      {blocked ? (
        <div role="alert" className="flex flex-col gap-4 rounded-xl border-2 border-danger bg-surface p-5">
          <p className="m-0 text-md font-semibold">{t('address.notServiceable', { names: blocked.names })}</p>
          <div className="flex flex-wrap gap-4">
            <Button
              variant="secondary"
              onClick={() => {
                setBlocked(null);
                setUseOther(true);
              }}
            >
              {t('address.change')}
            </Button>
            <Link href="/bundle" className={cx('inline-flex items-center font-display text-sm font-semibold underline underline-offset-4', FOCUS_RING)}>
              {t('address.editBundle')}
            </Link>
          </div>
        </div>
      ) : null}
      {failure ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {failure}
        </p>
      ) : null}
      <div>
        <Button type="submit" loading={busy} disabled={!canContinue}>
          {t('continue')}
        </Button>
      </div>
    </form>
  );
}
