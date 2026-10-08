import 'server-only';
import type { PaymentProvider, StoredMethodDescriptor } from '@/lib/checkout/payment-provider';
import { expandedCart } from '@/lib/mappers/recurring';
import { listRecurring, paymentMethodOf, pauseRecurring } from '@/lib/ct/recurring';

/**
 * Saved payment methods ("Payment methods", workstream T-08/T-09) over Checkout Stored Payment Methods, through the
 * `PaymentProvider` seam (the real adapter is `lib/ct/stored-methods.ts`; the fake in fixtures). The storefront holds
 * the provider's TOKEN only inside the adapter: everything here, and everything the page, the routes and the logs see,
 * is the descriptor (brand, last four, expiry, default flag).
 *
 *  - set default: the previous default is cleared explicitly by the adapter (open question: whether `setDefault`
 *    clears it on its own is unverified, T-todos);
 *  - remove the default: no other method is promoted (the buyer chooses at the next checkout);
 *  - remove a method an active auto-refill is charged to: refused with a warning until the buyer confirms; on
 *    confirmation the affected refills are paused (a refill that cannot be paid would only fail).
 * Net terms / credit line are B2C-excluded and not built.
 */

export type MethodProvider = Pick<PaymentProvider, 'listStoredMethods' | 'setDefaultStoredMethod' | 'removeStoredMethod'>;

export async function listMethods(customerId: string, provider: MethodProvider): Promise<StoredMethodDescriptor[]> {
  return provider.listStoredMethods(customerId);
}

export async function setDefaultMethod(customerId: string, methodId: string, provider: MethodProvider): Promise<StoredMethodDescriptor[]> {
  await provider.setDefaultStoredMethod(customerId, methodId);
  return provider.listStoredMethods(customerId);
}

/** Auto-refills (Active or Paused) whose recurring Cart charges this method. */
export async function refillsUsing(customerId: string, methodId: string): Promise<string[]> {
  const all = await listRecurring(customerId);
  return all.filter((r) => (r.recurringOrderState === 'Active' || r.recurringOrderState === 'Paused') && paymentMethodOf(expandedCart(r)) === methodId).map((r) => r.id);
}

export type RemoveOutcome =
  | { kind: 'removed'; methods: StoredMethodDescriptor[]; wasDefault: boolean; pausedRefills: number }
  /** An active auto-refill is charged to this method: nothing was removed; ask the buyer. */
  | { kind: 'refill-depends'; count: number };

export async function removeMethod(customerId: string, methodId: string, provider: MethodProvider, o: { confirm: boolean }): Promise<RemoveOutcome> {
  const before = await provider.listStoredMethods(customerId);
  const target = before.find((m) => m.id === methodId);
  const dependents = target ? await refillsUsing(customerId, methodId) : [];
  const active = dependents.length;
  if (active > 0 && !o.confirm) return { kind: 'refill-depends', count: active };
  await provider.removeStoredMethod(customerId, methodId);
  let paused = 0;
  for (const id of dependents) {
    await pauseRecurring(id).then(
      () => (paused += 1),
      () => undefined,
    );
  }
  return { kind: 'removed', methods: await provider.listStoredMethods(customerId), wasDefault: target?.isDefault ?? false, pausedRefills: paused };
}
