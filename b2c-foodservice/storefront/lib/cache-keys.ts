// Client (SWR) keys and server cache tags. Per-person keys always carry the customer id;
// market-scoped keys carry country and currency. Never a cart id.
export const KEY_ACCOUNT = 'account';
/** Base key of the cart; read as a plain string and used with mutate(KEY_CART, ...). */
export const KEY_CART = 'cart';
export const KEY_CART_COUNT = 'cart-count';
export const keyCart = (customerId: string | null) => [KEY_CART, customerId ?? 'guest'] as const;

export const keyOrders = (customerId: string) => ['orders', customerId] as const;
export const keyOrder = (customerId: string, orderId: string) => ['order', customerId, orderId] as const;
export const keyAddresses = (customerId: string) => ['addresses', customerId] as const;
export const keySavedItems = (customerId: string) => ['saved-items', customerId] as const;
export const keyMyReviews = (customerId: string) => ['my-reviews', customerId] as const;
export const keyReviews = (productId: string, sort: 'newest' | 'highest' | 'lowest', page: number) =>
  ['reviews', productId, sort, page] as const;
export const keyRecurringOrders = (customerId: string) => ['recurring-orders', customerId] as const;
export const keyShippingMethods = (country: string, currency: string) =>
  ['shipping-methods', country, currency] as const;
export const KEY_SELECTED_STORE = 'selected-store';
export const KEY_MARKET = 'market';
export const keyChannel = (id: string) => ['channel', id] as const;
export const keyChannels = (country: string) => ['channels', country] as const;
export const keyAvailability = (sku: string, country: string, storeKey: string | null) =>
  ['availability', sku, country, storeKey ?? 'online'] as const;
export const KEY_RECURRENCE_POLICIES = 'recurrence-policies';

export const TAG = {
  project: 'project',
  categories: 'categories',
  channels: 'channels',
  shippingMethods: 'shipping-methods',
  recurrencePolicies: 'recurrence-policies',
  attributeLabels: 'attribute-labels',
} as const;

/** Server cache lifetimes in seconds, public data only. */
export const TTL = {
  project: 300,
  categories: 60,
  channels: 60,
  shippingMethods: 60,
  recurrencePolicies: 300,
  attributeLabels: 3600,
} as const;
