'use client';

import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import type { Offer } from '@/lib/types';

/**
 * What the cards of one listing share, serialized ONCE by the server page instead of once per card: the add-on and equipment offers a
 * plan card can offer, the plan offers an add-on card can attach to, and the plan line the buyer came for (`?for=`, M's "Change" link).
 */
export interface ListingCandidates {
  addons: Offer[];
  equipment: Offer[];
  plans: Offer[];
  preferredParentLineId: string | null;
}

const EMPTY: ListingCandidates = { addons: [], equipment: [], plans: [], preferredParentLineId: null };
const ListingContext = createContext<ListingCandidates>(EMPTY);

export function useListing(): ListingCandidates {
  return useContext(ListingContext);
}

export function ListingProvider({ candidates, children }: { candidates: ListingCandidates; children: ReactNode }): ReactElement {
  const value = useMemo(() => candidates, [candidates]);
  return <ListingContext.Provider value={value}>{children}</ListingContext.Provider>;
}
