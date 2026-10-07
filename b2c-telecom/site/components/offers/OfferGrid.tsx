import type { ReactElement } from 'react';
import type { ListingKind, Offer } from '@/lib/types';
import { AddonCard } from './AddonCard';
import { DeviceListingSlot } from './DeviceListingSlot';
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
};

// Plans: cards of at least 300 px; add-ons and equipment: 280 px (design/specs/plp.md, addons.md), gap 24 px.
const GRID = 'm-0 grid list-none gap-7 p-0';
const PLAN_COLUMNS = '[grid-template-columns:repeat(auto-fill,minmax(min(100%,18.75rem),1fr))]';
const ADDON_COLUMNS = '[grid-template-columns:repeat(auto-fill,minmax(min(100%,17.5rem),1fr))]';

/** The cards of one listing page. The server renders the markup; every card is a client component that reads the bundle after hydration. */
export function OfferGrid({ kind, offers, highlightKey, candidates }: OfferGridProps): ReactElement {
  if (kind === 'devices') return <DeviceListingSlot offers={offers} highlightKey={highlightKey} />;
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
