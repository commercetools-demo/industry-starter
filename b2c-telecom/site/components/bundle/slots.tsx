import type { ReactElement } from 'react';
import { SaveBundleAsList } from '@/components/account/SaveBundleAsList';

// Hooks for later workstreams: U fills the "Order placed" banner above the content, T the "save my bundle" action in the summary.
// The save slot is filled by T (`SaveBundleAsList`).

export function OrderedBannerSlot(): ReactElement | null {
  return null;
}

export function SaveBundleSlot(): ReactElement | null {
  return <SaveBundleAsList />; // T
}
