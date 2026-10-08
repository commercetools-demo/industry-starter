// Client-safe session types. The session cookie holds references only, never a commercetools credential.

export type SessionData = {
  anonymousId?: string; // uuid minted when an anonymous visitor first needs a cart
  customerId?: string; // present only when signed in
  signedInAt?: string; // epoch milliseconds of the sign-in (R); compared with the customer's `sessionsValidAfter`. Kept when the cookie is re-signed
  cartId?: string; // reference to the active cart
  lastOrderNumber?: string; // lets a guest open its own confirmation page (D-035)
  pendingOrderNumber?: string; // U: the order number reserved for the payment in progress; reused by every retry so no duplicate order can exist
  pendingCartId?: string; // U: the cart that number belongs to
  pendingTotalCents?: string; // U: the total the payment session was started for
  locale?: string; // market snapshot at last write; NOT authoritative (use getMarket())
  country?: string;
  currency?: string;
};

export type SessionKind = 'none' | 'anonymous' | 'customer';

export type SessionSummary = { kind: SessionKind; customerId?: string; hasCart: boolean };
