/** App types for the quotes, sites and team screens (workstreams R and S). Client-safe: no commercetools imports. */

export type ThreadStatus = 'submitted' | 'preparing' | 'ready' | 'accepted' | 'declined' | 'renegotiation' | 'cancelled';

export interface Money { centAmount: number; currencyCode: string; fractionDigits: number }

export interface QuoteLine { name: string; quantity: number; frequency?: string; note?: string; unitPrice?: Money; total?: Money }

/** One negotiation round: a Quote issued by the seller (never present before the seller issues one). */
export interface QuoteRound {
  quoteId: string;
  createdAt: string;
  status: ThreadStatus;
  sellerComment?: string;
  buyerComment?: string;
  validTo?: string;
  expired: boolean;
  lines: QuoteLine[];
  total?: Money;
}

export interface ThreadActions { accept: boolean; decline: boolean; renegotiate: boolean; cancel: boolean }

/** One row of the quotes screen: a quote request together with its latest quote. `id` is the quote request id. */
export interface QuoteThread {
  id: string;
  reference: string;
  createdAt: string;
  services: string[];
  site: string;
  siteKey?: string;
  status: ThreadStatus;
  rounds: number;
  /** Id of the latest Quote: the target of accept, decline and renegotiate. */
  quoteId?: string;
  validTo?: string;
  expired: boolean;
  can: ThreadActions;
}

export interface QuoteThreadDetail extends QuoteThread {
  lines: QuoteLine[];
  /** The buyer's own note from the request. */
  comment?: string;
  history: QuoteRound[];
}

export interface Site { key: string; name: string; contactName: string; phone: string; streetName: string; city: string; postalCode: string; country: string; isDefault: boolean }
export interface SiteInput { name: string; contactName: string; phone: string; streetName: string; city: string; postalCode: string; country: string }
export interface SitesResult { sites: Site[]; canEdit: boolean }

export const TEAM_ROLES = ['mpw-admin', 'mpw-site-contact', 'mpw-finance'] as const;
export type TeamRoleKey = (typeof TEAM_ROLES)[number];

export interface TeamMember { customerId: string; name: string; email: string; roleKeys: string[]; isYou: boolean }
export interface TeamResult { members: TeamMember[]; canEdit: boolean }
export interface TeamInput { firstName: string; lastName: string; email: string; roleKey: TeamRoleKey }
/** The temporary password is part of this response only; it is never stored or logged. */
export interface InviteResult { member: TeamMember; temporaryPassword: string }
