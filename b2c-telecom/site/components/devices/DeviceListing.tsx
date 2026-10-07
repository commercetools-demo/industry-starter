'use client';

import type { ReactElement } from 'react';
import { useTranslations } from 'next-intl';
import { OfferAnchor } from '@/components/offers/OfferAnchor';
import { useToast } from '@/components/ui/Toast';
import { useDeviceActions } from '@/hooks/useDeviceActions';
import type { AddDeviceArgs, DeviceOffer } from '@/lib/types';
import { DeviceCard } from './DeviceCard';

type DeviceListingProps = {
  offers: DeviceOffer[];
  /** `YYYY-MM-DD` of the request. */
  today: string;
  /** The offer of the `?offer=` link: its card is outlined and scrolled to. */
  highlightKey: string | null;
};

/** The devices category: one card per handset. Adding goes through the device route and ends in the toast "{name} added to your bundle". */
export function DeviceListing({ offers, today, highlightKey }: DeviceListingProps): ReactElement {
  const tb = useTranslations('bundle');
  const toast = useToast();
  const { addDeviceLine } = useDeviceActions();

  const add = async (name: string, args: AddDeviceArgs): Promise<void> => {
    await addDeviceLine(args);
    toast.show({ message: tb('toast.added', { name }), actionLabel: tb('toast.view'), href: '/bundle' });
  };

  return (
    <>
      <ul className="m-0 grid list-none gap-7 p-0 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]">
        {offers.map((offer) => (
          <li key={offer.key}>
            <DeviceCard offer={offer} today={today} highlighted={offer.key === highlightKey} onAdd={(args) => add(offer.name, args)} />
          </li>
        ))}
      </ul>
      {highlightKey ? <OfferAnchor offerKey={highlightKey} /> : null}
    </>
  );
}
