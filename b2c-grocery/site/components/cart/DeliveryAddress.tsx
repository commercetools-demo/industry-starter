'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useAccount } from '@/hooks/useAccount';
import { useAddresses } from '@/hooks/useAddresses';
import type { AddressInput, DeliveryResult } from '@/hooks/useDelivery';
import type { Address, SavedAddress } from '@/lib/types';
import { COUNTRY_CONFIG } from '@/lib/utils';
import { AddressForm } from './AddressForm';
import { NEW_ADDRESS, SavedAddressPicker } from './SavedAddressPicker';

const FIELDS = ['firstName', 'lastName', 'streetName', 'additionalStreetInfo', 'postalCode', 'city', 'country', 'phone'] as const;
const same = (a: Address, b: Address): boolean => FIELDS.every((f) => (a[f] ?? '') === (b[f] ?? ''));

const toInput = (a: SavedAddress): AddressInput => ({
  firstName: a.firstName ?? '',
  lastName: a.lastName ?? '',
  streetName: a.streetName ?? '',
  postalCode: a.postalCode ?? '',
  city: a.city ?? '',
  country: a.country,
  ...(a.additionalStreetInfo ? { additionalStreetInfo: a.additionalStreetInfo } : {}),
  ...(a.phone ? { phone: a.phone } : {}),
});

/**
 * The address part of the delivery step. Anonymous shoppers (and customers without saved addresses) get the manual
 * form. Signed-in customers with saved addresses get `SavedAddressPicker`: the cart's address is selected when it is a
 * saved one; a cart without an address gets the default shipping address applied (once) so slots can load; any other
 * cart address stays as it is and shows in the form under "Add a new address".
 */
export function DeliveryAddress({ address, onSave }: { address?: Address; onSave: (address: AddressInput) => Promise<DeliveryResult> }) {
  const t = useTranslations('cart');
  const locale = useLocale();
  const { user } = useAccount();
  const { addresses, defaultAddress, isLoading } = useAddresses({ enabled: user !== null });
  const marketCountry = COUNTRY_CONFIG[locale]?.country ?? Object.values(COUNTRY_CONFIG)[0].country;
  const [chosen, setChosen] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoApplied = useRef(false);

  const matching = address ? addresses.find((a) => same(a, address)) : undefined;
  const defaultUsable = defaultAddress !== null && defaultAddress.country === marketCountry;
  const selected = chosen ?? matching?.id ?? (!address && defaultAddress && defaultUsable ? defaultAddress.id : NEW_ADDRESS);

  const apply = async (saved: SavedAddress) => {
    setPending(true);
    setError(null);
    const result = await onSave(toInput(saved));
    setPending(false);
    if (result.ok) return;
    setError(
      result.error === 'UNDELIVERABLE'
        ? t('step.undeliverable')
        : result.error === 'COUNTRY_MISMATCH'
          ? t('step.countryMismatch')
          : result.error === 'SHIPPING_UNAVAILABLE'
            ? t('step.shippingUnavailable')
            : t('step.saveFailed'),
    );
  };

  // A cart without an address: apply the default shipping address once (the shopper can still choose another).
  const applyDefault = useRef(apply);
  useEffect(() => {
    applyDefault.current = apply;
  });
  const defaultId = defaultAddress?.id;
  useEffect(() => {
    if (autoApplied.current || address || !defaultAddress || !defaultUsable || isLoading) return;
    autoApplied.current = true;
    void applyDefault.current(defaultAddress);
    // `defaultAddress` identity changes with every list refresh; the id decides.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, defaultId, defaultUsable, isLoading]);

  if (user !== null && isLoading && addresses.length === 0) {
    return (
      <p aria-busy="true" className="m-0 text-[14px] text-text/60">
        {t('saved.loading')}
      </p>
    );
  }
  if (user === null || addresses.length === 0) return <AddressForm address={address} onSave={onSave} />;

  const onSelect = (choice: SavedAddress | typeof NEW_ADDRESS) => {
    if (choice === NEW_ADDRESS) {
      setChosen(NEW_ADDRESS);
      setError(null);
      return;
    }
    setChosen(choice.id);
    void apply(choice);
  };

  return (
    <div className="flex flex-col gap-(--space-4)">
      <SavedAddressPicker addresses={addresses} selected={selected} marketCountry={marketCountry} pending={pending} error={error} onSelect={onSelect} />
      {selected === NEW_ADDRESS ? <AddressForm key="new" address={matching ? undefined : address} onSave={onSave} /> : null}
    </div>
  );
}
