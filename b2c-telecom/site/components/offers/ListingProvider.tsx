'use client';

import { createContext, useContext, useMemo, type ReactElement, type ReactNode } from 'react';
import type { Offer } from '@/lib/types';

/**
 * What the cards of one listing share, serialized ONCE by the server page instead of once per card: the add-on and equipment offers a
 * plan card can offer, the plan offers an add-on card can attach to, the plan line the buyer came for (`?for=`, M's "Change" link) and
 * the localized paths of the categories the cards link to (a client component cannot read the category tree).
 */
export interface ListingCandidates {
  addons: Offer[];
  equipment: Offer[];
  plans: Offer[];
  preferredParentLineId: string | null;
  /** Paths without the locale prefix; null when the category is not in the tree. */
  links: { addons: string | null; internetPlans: string | null; phonePlans: string | null };
}

const EMPTY: ListingCandidates = { addons: [], equipment: [], plans: [], preferredParentLineId: null, links: { addons: null, internetPlans: null, phonePlans: null } };
const ListingContext = createContext<ListingCandidates>(EMPTY);

export function useListing(): ListingCandidates {
  return useContext(ListingContext);
}

export function ListingProvider({ candidates, children }: { candidates: ListingCandidates; children: ReactNode }): ReactElement {
  const value = useMemo(() => candidates, [candidates]);
  return <ListingContext.Provider value={value}>{children}</ListingContext.Provider>;
}
