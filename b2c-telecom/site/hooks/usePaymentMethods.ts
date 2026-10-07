'use client';

import { useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { KEY_PAYMENT_METHODS } from '@/lib/cache-keys';
import type { PaymentMethodView } from '@/lib/types';
import { accountRequest } from './accountRequest';

export { KEY_PAYMENT_METHODS };

const URL = '/api/account/payment-methods';
type Payload = { paymentMethods: PaymentMethodView[] };

/** The stored payment methods of the signed-in customer (never the token). */
export function usePaymentMethods() {
  const { data, error, isLoading } = useSWR<Payload>(KEY_PAYMENT_METHODS, () => accountRequest<Payload>(URL, 'GET'));
  return { paymentMethods: data?.paymentMethods ?? [], isLoading, error };
}

export interface PaymentMethodMutations {
  makeDefault: (id: string) => Promise<PaymentMethodView[]>;
  remove: (id: string) => Promise<PaymentMethodView[]>;
}

/** Every write answers with the whole list, which goes into the cache as it is. */
export function usePaymentMethodMutations(): PaymentMethodMutations {
  const { mutate } = useSWRConfig();
  return useMemo<PaymentMethodMutations>(() => {
    const store = async (payload: Payload): Promise<PaymentMethodView[]> => {
      await mutate(KEY_PAYMENT_METHODS, payload, { revalidate: false });
      return payload.paymentMethods;
    };
    return {
      makeDefault: async (id) => store(await accountRequest<Payload>(`${URL}/${encodeURIComponent(id)}/default`, 'POST', {})),
      remove: async (id) => store(await accountRequest<Payload>(`${URL}/${encodeURIComponent(id)}`, 'DELETE')),
    };
  }, [mutate]);
}
