/** App types. Components import only from here, never from the commercetools SDK. A service has no price field by design. */
export interface FaqItem { question: string; answer: string }

export interface Service {
  id: string;
  key: string;
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: 'plumbing' | 'waste-management';
  sectors: string[];
  frequencies: string[];
  included: string[];
  steps: string[];
  records: string[];
  faq: FaqItem[];
  relatedIds: string[];
  needsWasteDetails: boolean;
  order: number;
  imageUrl?: string;
}

export interface Category { id: string; key: string; slug: string; name: string }

export interface BusinessUnitSummary { key: string; name: string; unitType: string; storeKeys: string[] }

export interface Account { customerId: string; email: string; firstName?: string; lastName?: string; businessUnitKey: string | null }
export interface QuoteListLine {
  id: string; serviceId: string; slug: string; name: string; frequency?: string; note?: string; quantity: number;
  /** Set by the quote-list API (workstream P). */
  category?: Service['category'];
  /** The frequencies the service supports, besides "one-off". */
  frequencies?: string[];
  /** False when the service was unpublished or left the store since it was added. */
  available?: boolean;
  needsWasteDetails?: boolean;
}
export interface QuoteList {
  id: string | null; lines: QuoteListLine[]; count: number;
  /** The service was already in the list; nothing was added. */
  alreadyInList?: boolean;
  /** The list was started again in another currency (locale switch). */
  rebuilt?: boolean;
}
