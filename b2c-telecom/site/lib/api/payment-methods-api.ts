import 'server-only';
import { listPaymentMethods, PaymentMethodNotFoundError, PaymentMethodsForbiddenError } from '@/lib/ct/payment-methods';
import { mapPaymentMethod } from '@/lib/mappers/paymentMethod';
import { getMarket } from '@/lib/market/server';
import type { PaymentMethodView } from '@/lib/types';
import { AccountRefusal } from './account-api';

/** The customer's active methods as the buyer may see them (the token never leaves the server: the mapper does not copy it). */
export async function paymentMethodViews(customerId: string): Promise<{ paymentMethods: PaymentMethodView[] }> {
  const [methods, market] = await Promise.all([listPaymentMethods(customerId), getMarket()]);
  return { paymentMethods: methods.map((pm) => mapPaymentMethod(pm, market.locale)) };
}

/** 404 PAYMENT_METHOD_NOT_FOUND (foreign and unknown ids look the same), 503 PAYMENT_METHODS_UNAVAILABLE (missing scope). */
export async function withPaymentErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PaymentMethodNotFoundError) throw new AccountRefusal(404, 'PAYMENT_METHOD_NOT_FOUND', 'Payment method not found.');
    if (error instanceof PaymentMethodsForbiddenError) throw new AccountRefusal(503, 'PAYMENT_METHODS_UNAVAILABLE', 'Saved payment methods are temporarily unavailable.');
    throw error;
  }
}
