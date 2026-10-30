import 'server-only';
import { cache } from 'react';
import type { ListingResult, ListingView } from '@/lib/listing/load';

/**
 * The listing of the current request, shared with the page builder's listing components. A category route starts the native
 * load (`getListing`, itself memoised per request) and hands the promise over before it asks the page builder for the layout;
 * every placed component then awaits the same promise, so the listing is loaded once however many components an author places.
 * `cache` gives one holder per server render, so two shoppers never see each other's listing.
 */
const holder = cache((): { result?: Promise<ListingResult> } => ({}));

export function provideListing(result: Promise<ListingResult>): void {
  holder().result = result;
}

/** The listing of this request, or null off a category page or when the listing is not a normal result (redirect, prompt). */
export async function requestListing(): Promise<ListingView | null> {
  const result = await holder().result;
  return result && result.kind === 'ok' ? result : null;
}
