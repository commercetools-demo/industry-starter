'use client';

import useSWR from 'swr';
import { jsonFetcher } from '@/hooks/fetcher';
import { keyChannels } from '@/lib/cache-keys';
import type { Store } from '@/lib/types';

export interface ChannelsResponse { stores: Store[]; selectedKey: string | null }

/**
 * Stores of the market's country plus the session's chosen store key.
 * Contract for G, H and I: prefer `useCollectionStore()`; this is the raw read behind it.
 * Pass the market country (from the locale) so the key changes with the market.
 */
export function useChannels(country: string) {
  return useSWR<ChannelsResponse>(
    keyChannels(country),
    () => jsonFetcher<ChannelsResponse>(`/api/channels?country=${encodeURIComponent(country)}`),
    { revalidateOnFocus: false },
  );
}
