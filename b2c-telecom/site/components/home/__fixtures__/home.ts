import {
  LISTED_APPLETV,
  LISTED_CABLE_100,
  LISTED_CABLE_500,
  LISTED_CABLE_EXISTING,
  LISTED_CABLE_GIG,
  LISTED_NETFLIX,
  LISTED_PHONE_ESSENTIAL,
  LISTED_PHONE_ONLINE_ONLY,
  LISTED_PHONE_PLUS,
  LISTED_PHONE_UNLIMITED,
  LISTED_SPOTIFY,
  LISTED_WIRELESS_5G,
  LISTED_WIRELESS_LITE,
  TREE,
} from '@/lib/listing/__fixtures__/catalog';
import type { Category, Offer } from '@/lib/types';

export const HERO_IMAGE = 'https://images.pexels.com/photos/1/hero.jpeg';
export const HERO_ALT = 'Photo: Jane Doe via Pexels';

/** The listing fixtures' seeded-like tree with the cable category carrying an image. */
export const HOME_TREE: Category[] = TREE.map((category) => (category.key === 'malva-cat-cable-internet' ? { ...category, image: HERO_IMAGE, imageAlt: HERO_ALT } : category));

export const LISTED_APPLEMUSIC: Offer = { ...LISTED_SPOTIFY, id: 'id-malva-offer-applemusic', key: 'malva-offer-applemusic', anchors: ['malva-applemusic'], name: 'Apple Music', headline: { term: null, termMonths: null, recurring: { centAmount: 1100, currencyCode: 'USD' } } };

export const CABLE_OFFERS: Offer[] = [LISTED_CABLE_100, LISTED_CABLE_500, LISTED_CABLE_GIG, LISTED_CABLE_EXISTING];
export const WIRELESS_OFFERS: Offer[] = [LISTED_WIRELESS_LITE, LISTED_WIRELESS_5G];
export const PHONE_OFFERS: Offer[] = [LISTED_PHONE_ESSENTIAL, LISTED_PHONE_PLUS, LISTED_PHONE_UNLIMITED, LISTED_PHONE_ONLINE_ONLY];
export const ADDON_OFFERS: Offer[] = [LISTED_SPOTIFY, LISTED_APPLETV, LISTED_APPLEMUSIC, LISTED_NETFLIX];

export const OFFERS_BY_CATEGORY: Record<string, Offer[]> = {
  'malva-cat-cable-internet': CABLE_OFFERS,
  'malva-cat-home-wireless': WIRELESS_OFFERS,
  'malva-cat-phone-plans': PHONE_OFFERS,
  'malva-cat-add-ons': ADDON_OFFERS,
  'malva-cat-devices': [],
};
