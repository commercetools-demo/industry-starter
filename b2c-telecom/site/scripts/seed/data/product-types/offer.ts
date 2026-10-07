import type { ProductTypeDraft } from '../../types';
import { own, shared } from '../shared/attributes';
import { AUDIENCE, EXISTING_CUSTOMER, OFFER_KIND } from '../shared/enums';

const required = { isRequired: true };
const textSet = { name: 'set', elementType: { name: 'text' } } as const;

// The offer is what the storefront lists, prices and puts in the bundle (D-010, D-011).
export const offerType: ProductTypeDraft = {
  key: 'malva-offer',
  name: 'Malva offer',
  description: 'Sellable wrapper: audience, channels, start and end time and relations live here. Prices live on its variants.',
  attributes: [
    // savedToLineItem: the shipping and cart-discount predicates read these on the line item
    own('offer-kind', 'Offer kind', 'Angebotsart', { name: 'enum', values: OFFER_KIND }, { isRequired: true, isSearchable: true, savedToLineItem: true }),
    own('offer-family', 'Offer family', 'Angebotsfamilie', { name: 'text' }, { isRequired: true, isSearchable: true, savedToLineItem: true }),
    own('anchors', 'Anchors (product keys)', 'Verknüpfte Produkte (Schlüssel)', textSet, { isRequired: true }),
    own('included-offers', 'Included offers', 'Enthaltene Angebote', textSet),
    own('compatible-addons', 'Compatible add-ons (exceptions)', 'Kompatible Zusatzangebote (Ausnahmen)', textSet),
    own('compatible-equipment', 'Compatible equipment (exceptions)', 'Kompatible Geräte (Ausnahmen)', textSet),
    shared('conflicts-with'),
    own('audience', 'Audience', 'Zielgruppe', { name: 'set', elementType: { name: 'enum', values: AUDIENCE } }, { isRequired: true, isSearchable: true }),
    own('existing-customer', 'Existing customer', 'Bestandskunde', { name: 'enum', values: EXISTING_CUSTOMER }, { isRequired: true, isSearchable: true }),
    own('channels', 'Sales channels (empty = all)', 'Vertriebskanäle (leer = alle)', textSet, { isSearchable: true }),
    own('start-time', 'Start time', 'Startzeitpunkt', { name: 'datetime' }, { isSearchable: true }),
    own('end-time', 'End time', 'Endzeitpunkt', { name: 'datetime' }, { isSearchable: true }),
    shared('contract-term', required),
    shared('charge-type', required),
    shared('technology'),
    shared('downstream-mbps'),
    shared('data-gb'),
    shared('network-generation'),
    shared('badge'),
    shared('addon-tag'),
    shared('color'),
    shared('memory-gb'),
    own('intro-free-months', 'Introductory free months', 'Kostenlose Einführungsmonate', { name: 'number' }, { savedToLineItem: true }),
    own('price-steps', 'Price steps (JSON)', 'Preisstufen (JSON)', { name: 'text' }),
  ],
};
