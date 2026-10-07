// Client-safe session types. The session cookie holds references only, never a commercetools credential.

export type SessionData = {
  anonymousId?: string; // uuid minted when an anonymous visitor first needs a cart
  customerId?: string; // present only when signed in
  cartId?: string; // reference to the active cart
  lastOrderNumber?: string; // lets a guest open its own confirmation page (D-035)
  locale?: string; // market snapshot at last write; NOT authoritative (use getMarket())
  country?: string;
  currency?: string;
};

export type SessionKind = 'none' | 'anonymous' | 'customer';

export type SessionSummary = { kind: SessionKind; customerId?: string; hasCart: boolean };
