import type { ReactElement } from 'react';
import { DeviceListing } from '@/components/devices/DeviceListing';
import type { DeviceOffer, ListingKind, Offer } from '@/lib/types';
import { AddonCard } from './AddonCard';
import { ListingProvider, type ListingCandidates } from './ListingProvider';
import { OfferAnchor } from './OfferAnchor';
import { OfferCard } from './OfferCard';

type OfferGridProps = {
  kind: ListingKind;
  offers: Offer[];
  /** The offer of the `?offer=` link: its card is outlined and scrolled to. */
  highlightKey: string | null;
  /** What the cards share (add-ons, equipment, plans, paths), serialized once for all cards. */
  candidates: ListingCandidates;
  /** Devices listing (workstream Q): the handsets of this page with their prices per mode, and `YYYY-MM-DD` of the request. */
  devices?: { offers: DeviceOffer[]; today: string };
};

// Plans: cards of at least 300 px; add-ons and equipment: 280 px (design/specs/plp.md, addons.md), gap 24 px.
const GRID = 'm-0 grid list-none gap-7 p-0';
const PLAN_COLUMNS = '[grid-template-columns:repeat(auto-fill,minmax(min(100%,18.75rem),1fr))]';
const ADDON_COLUMNS = '[grid-template-columns:repeat(auto-fill,minmax(min(100%,17.5rem),1fr))]';

/** The cards of one listing page. The server renders the markup; every card is a client component that reads the bundle after hydration. */
export function OfferGrid({ kind, offers, highlightKey, candidates, devices }: OfferGridProps): ReactElement {
  if (kind === 'devices') return <DeviceListing offers={devices?.offers ?? []} today={devices?.today ?? ''} highlightKey={highlightKey} />;
  return (
    <ListingProvider candidates={candidates}>
      <ul className={`${GRID} ${kind === 'plans' ? PLAN_COLUMNS : ADDON_COLUMNS}`}>
        {offers.map((offer) => (
          <li key={offer.key}>{kind === 'plans' ? <OfferCard offer={offer} highlighted={offer.key === highlightKey} /> : <AddonCard offer={offer} highlighted={offer.key === highlightKey} />}</li>
        ))}
      </ul>
      {highlightKey ? <OfferAnchor offerKey={highlightKey} /> : null}
    </ListingProvider>
  );
}
