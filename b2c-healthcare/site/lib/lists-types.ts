// Shapes of the saved lists ("My medicines"). Types and pure constants only: safe in client components.
import type { Money } from '@/lib/types';
import type { NotAddedReason } from '@/lib/order-types';

/** The list that "Save to My medicines" fills; created on first use. Key `mlv-list-my-medicines`. */
export const DEFAULT_LIST_ID = 'my-medicines';
export const MAX_LIST_NAME = 60;
/** commercetools holds 250 line items per Shopping List (saved-lists spec). */
export const MAX_LIST_LINES = 250;

export interface ListSummary {
  id: string;
  name: string;
  lineCount: number;
  /** ISO instant. */
  updatedAt: string;
}

export interface ListLineView {
  id: string;
  name: string;
  sku: string;
  /** Catalog pack price at view time (null = not purchasable in this region or product gone). */
  price: Money | null;
  /** The price when the line was saved; null when not recorded. */
  savedPrice: Money | null;
  /** price - savedPrice in cents, only when both exist and differ. Shown as a note, never repriced silently. */
  priceDeltaCents: number | null;
  /** The product is no longer in the catalog / has no price here. Named when the list is added to the cart. */
  unavailable: boolean;
}

export interface ListView extends ListSummary {
  lines: ListLineView[];
}

export interface AddAllResult {
  /** Names of the medicines put in the cart. */
  added: string[];
  /** Medicines that could not be added, named with the reason. The added ones stay in the cart. */
  notAdded: { name: string; reason: NotAddedReason }[];
}
