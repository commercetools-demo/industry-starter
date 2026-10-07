// Constants of the stored payment methods (workstream T). Never inline these numbers.

/** A customer may have at most 50 active payment methods (and 100 inactive ones). */
export const PAYMENT_METHODS_LIMIT = 50;
/** Custom type of the display fields (brand, last4, expMonth, expYear) on a PaymentMethod. */
export const PAYMENT_METHOD_TYPE_KEY = 'malva-payment-method';
