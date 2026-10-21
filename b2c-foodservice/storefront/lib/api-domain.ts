import 'server-only';

/** Domain codes of the auth workstream (Q-J-13). D's `ErrorCode` stays closed; these never carry commercetools text. */
export type DomainErrorCode =
  | 'invalid_credentials'
  | 'too_many_attempts'
  | 'password_policy'
  | 'registration_failed'
  | 'invalid_request'
  | 'not_found'
  | 'token_invalid'
  // Workstream H: add-to-bag outcomes the product page explains (Q-H-15).
  | 'not_available_for_collection'
  | 'collect_not_available_in_market'
  | 'unknown_store'
  | 'unknown_policy'
  | 'price_unavailable'
  // Workstream M: one review per product and customer.
  | 'already_reviewed'
  // Workstream I: cart changes the bag page explains.
  | 'line_not_found'
  | 'quantity_exceeds_stock'
  | 'store_required'
  | 'subscribe_line_not_switchable'
  | 'code_not_applied'
  // Workstream K: checkout and orders.
  | 'cart_not_found'
  | 'cart_empty'
  | 'totals_changed'
  | 'checkout_not_ready'
  | 'order_exists'
  | 'sign_in_required'
  | 'checkout_blocked'
  | 'collect_out_of_stock'
  | 'collect_not_available'
  | 'order_not_found'
  // Workstream L: account area.
  | 'return_window_closed'
  | 'not_returnable'
  | 'address_needs_confirmation'
  | 'current_password_invalid'
  | 'list_full'
  | 'list_empty';

const DOMAIN_MESSAGES: Record<DomainErrorCode, string> = {
  invalid_credentials: 'Email or password is incorrect',
  too_many_attempts: 'Too many attempts. Please try again later',
  password_policy: 'The password does not meet the requirements',
  registration_failed: 'We could not create the account with these details',
  invalid_request: 'The request could not be understood',
  not_found: 'Not found',
  token_invalid: 'This link is no longer valid',
  not_available_for_collection: 'This item is not available for collection at that store',
  collect_not_available_in_market: 'Collection is not available in this market',
  unknown_store: 'That store is not available',
  unknown_policy: 'That delivery interval is not available',
  price_unavailable: 'No price is available for this item',
  already_reviewed: 'You have already reviewed this product',
  line_not_found: 'That item is not in your bag',
  quantity_exceeds_stock: 'That quantity is not available',
  store_required: 'Choose a store to collect from',
  subscribe_line_not_switchable: 'A subscription cannot be switched between collection and delivery',
  code_not_applied: 'That code could not be applied',
  cart_not_found: 'There is no bag to check out',
  cart_empty: 'Your bag is empty',
  totals_changed: 'The totals changed. Please review your bag',
  checkout_not_ready: 'Checkout is not ready yet',
  order_exists: 'This order was already placed',
  sign_in_required: 'Sign in to check out with this bag',
  checkout_blocked: 'Review your bag before checking out',
  collect_out_of_stock: 'An item is not in stock at the collection store',
  collect_not_available: 'Collection is not available in this market',
  order_not_found: 'Order not found',
  return_window_closed: 'The return window for this order has closed',
  not_returnable: 'This order cannot be returned',
  address_needs_confirmation: 'Please check this address',
  current_password_invalid: 'The current password is incorrect',
  list_full: 'Your saved items list is full',
  list_empty: 'You have no saved items',
};

/** Same envelope as D: `{ error: { code, message, ...extra } }`. Extras are plain data (rule ids, retryAfterSeconds). */
export function domainError(
  code: DomainErrorCode,
  status: number,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json({ error: { code, message: DOMAIN_MESSAGES[code], ...extra } }, { status });
}
