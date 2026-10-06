'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';
import { Card, CardKicker } from '@/components/ui/Card';
import { useProfile } from '@/hooks/useOrders';
import type { Address } from '@/lib/types';

/** Name, street, "postcode city" and country: the lines the card shows (empty parts are skipped). */
export function addressLines(address: Address): string[] {
  const name = [address.firstName, address.lastName].filter(Boolean).join(' ');
  const city = [address.postalCode, address.city].filter(Boolean).join(' ');
  return [name, address.streetName, address.additionalStreetInfo, city, address.country].filter((l): l is string => Boolean(l));
}

/** Default shipping address card with a ghost Edit link to the address book (S); empty state when there is none. */
export function AddressCard() {
  const t = useTranslations('account.address');
  const tAccount = useTranslations('account');
  const { profile, error, isLoading } = useProfile();
  const address = profile?.defaultShippingAddress;
  return (
    <Card elev="sm" className="p-[17.6px]" aria-labelledby="account-address-kicker">
      <CardKicker>
        <span id="account-address-kicker">{t('kicker')}</span>
      </CardKicker>
      {address ? (
        <>
          <address className="m-0 text-[15px] not-italic leading-[1.6]">
            {addressLines(address).map((line, i) => (
              <div key={`${i}-${line}`}>{line}</div>
            ))}
          </address>
          <div>
            <Button href="/account/addresses" variant="ghost">
              {t('edit')}
            </Button>
          </div>
        </>
      ) : error ? (
        <p role="alert" className="m-0 text-[14px] text-text/60">
          {tAccount('loadFailed')}
        </p>
      ) : isLoading ? (
        <p aria-busy="true" className="m-0 text-[14px] text-text/60">
          {tAccount('loading')}
        </p>
      ) : (
        <>
          <p className="m-0 text-[15px] text-text/60">{t('empty')}</p>
          <div>
            <Button href="/account/addresses" variant="ghost">
              {t('add')}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
