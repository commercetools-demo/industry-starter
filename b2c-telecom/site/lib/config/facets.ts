import type { Offer } from '@/lib/types';

export const LISTING_PAGE_SIZE = 12;

/** D-017 filter chips per category key (a child category uses its root's chips). Chip ids are the `?chip=` values. */
export const CHIPS_BY_CATEGORY: Record<string, readonly string[]> = {
  'malva-cat-phone-plans': ['all', 'unlimited', 'data-capped'],
  'malva-cat-home-wireless': ['all', '5g', 'lte'],
  'malva-cat-cable-internet': ['all', 'up-to-500', '1-gbps'],
  'malva-cat-add-ons': ['all', 'music', 'video', 'extras'],
};
export const DEFAULT_CHIPS: readonly string[] = ['all'];

const plan = (offer: Offer) => (offer.facts?.kind === 'plan' ? offer.facts : null);
const addonTag = (offer: Offer): string | undefined => (offer.facts?.kind === 'addon' ? offer.facts.tag?.toLowerCase() : undefined);

/** Predicates over `offer.facts` (the attributes live on the plan product, which the search index does not hold). */
export const CHIP_PREDICATES: Record<string, (offer: Offer) => boolean> = {
  all: () => true,
  unlimited: (offer) => plan(offer)?.dataGb === -1,
  'data-capped': (offer) => {
    const dataGb = plan(offer)?.dataGb;
    return dataGb !== undefined && dataGb >= 0;
  },
  '5g': (offer) => plan(offer)?.networkGeneration === '5g',
  lte: (offer) => plan(offer)?.networkGeneration === '4g',
  'up-to-500': (offer) => {
    const mbps = plan(offer)?.downstreamMbps;
    return mbps !== undefined && mbps <= 500;
  },
  '1-gbps': (offer) => {
    const mbps = plan(offer)?.downstreamMbps;
    return mbps !== undefined && mbps > 500;
  },
  music: (offer) => addonTag(offer) === 'music',
  video: (offer) => addonTag(offer) === 'video',
  extras: (offer) => addonTag(offer) === 'extras',
};
