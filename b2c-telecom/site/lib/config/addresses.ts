// Constants of the address book (workstream T). Never inline these numbers.

/** The commercetools docs suggest at most 10 addresses per customer. */
export const ADDRESS_BOOK_LIMIT = 10;
/** Every text value of an address may be at most this long. */
export const ADDRESS_FIELD_MAX = 100;
/** Countries the storefront sells in (D-004). */
export const ADDRESS_COUNTRIES = ['US', 'DE'] as const;
