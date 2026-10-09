import 'server-only';
import type { PaymentMethod } from '@commercetools/platform-sdk';
import { apiRoot } from '@/lib/ct/client';
import { StoredMethodNotFoundError, type StoredMethodDescriptor } from '@/lib/checkout/payment-provider';

/**
 * Checkout Stored Payment Methods through the commercetools PaymentMethod API. The adapter side
 * of `PaymentProvider.listStoredMethods / setDefaultStoredMethod / removeStoredMethod`.
 *
 *  - Every operation is scoped to the customer (`customer(id=...)`): somebody else's method is the same
 *    `StoredMethodNotFoundError` as an unknown id.
 *  - `mapDescriptor` copies brand, last four, expiry and the default flag and NOTHING ELSE: `token.value` is never read
 *    here, so it cannot reach a response, a log line or a React prop.
 *  - `setDefault` is a boolean per method (the spec's open question is whether the platform clears the previous
 *    default), so the previous default(s) are cleared explicitly first, then the chosen one is set; a failure after the
 *    clearing leaves NO default, which is the safe state (the next checkout asks).
 *  - Removing is a `DELETE` with the current version; the removed method is not replaced as default.
 *
 * Where the connector keeps the card brand and last four digits on the PaymentMethod is connector-defined; the mapper
 * reads the custom fields `brand`/`last4`/`expMonth`/`expYear` and falls back to a display name such as
 * "Visa ending 4242" (live check in T-todos).
 * Scopes: `manage_payment_methods`.
 */

type Root = typeof apiRoot;

const isNotFound = (e: unknown): boolean => (e as { statusCode?: number } | null)?.statusCode === 404;
const isConflict = (e: unknown): boolean => (e as { statusCode?: number } | null)?.statusCode === 409;

const asText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const asInt = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,4}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) ? n : null;
};

/** `Visa ending 4242`, `Visa •••• 4242`, `Visa 4242` -> brand and last four. */
function fromName(name: string | null): { brand: string | null; last4: string | null } {
  if (!name) return { brand: null, last4: null };
  const m = /^(.*?)[\s•*.-]*(?:ending(?:\s+in)?\s+)?[\s•*.-]*(\d{4})\s*$/i.exec(name);
  return m ? { brand: asText(m[1]), last4: m[2] ?? null } : { brand: name, last4: null };
}

/** The ONLY place a stored method is read: descriptor fields in, descriptor out. */
export function mapDescriptor(pm: PaymentMethod): StoredMethodDescriptor {
  const f = (pm.custom?.fields ?? {}) as Record<string, unknown>;
  const name = pm.name ? asText(Object.values(pm.name)[0]) : null;
  const parsed = fromName(name);
  const last4 = asText(f.last4 ?? f.cardLast4) ?? parsed.last4 ?? '';
  return {
    id: pm.id,
    brand: asText(f.brand ?? f.cardBrand) ?? parsed.brand ?? 'Card',
    last4: /^\d{4}$/.test(last4) ? last4 : '',
    expMonth: asInt(f.expMonth ?? f.expiryMonth),
    expYear: asInt(f.expYear ?? f.expiryYear),
    isDefault: pm.default,
  };
}

async function activeMethods(root: Root, customerId: string): Promise<PaymentMethod[]> {
  const { body } = await root
    .paymentMethods()
    .get({ queryArgs: { where: 'customer(id=:id) and paymentMethodStatus="Active"', 'var.id': customerId, sort: 'createdAt asc', limit: 50 } })
    .execute();
  return body.results;
}

/** Descriptors, the default first, then oldest first. */
export async function listStored(customerId: string, root: Root = apiRoot): Promise<StoredMethodDescriptor[]> {
  const methods = (await activeMethods(root, customerId)).map(mapDescriptor);
  return [...methods.filter((m) => m.isDefault), ...methods.filter((m) => !m.isDefault)];
}

async function ownMethod(root: Root, customerId: string, methodId: string): Promise<PaymentMethod> {
  if (!/^[\w-]{1,64}$/.test(methodId)) throw new StoredMethodNotFoundError();
  try {
    const { body } = await root.paymentMethods().withId({ ID: methodId }).get().execute();
    if (body.customer?.id !== customerId || body.paymentMethodStatus !== 'Active') throw new StoredMethodNotFoundError();
    return body;
  } catch (error) {
    if (isNotFound(error)) throw new StoredMethodNotFoundError();
    throw error;
  }
}

async function setDefaultFlag(root: Root, id: string, value: boolean): Promise<void> {
  for (let attempt = 0; ; attempt += 1) {
    const { body: current } = await root.paymentMethods().withId({ ID: id }).get().execute();
    if (current.default === value) return;
    try {
      await root.paymentMethods().withId({ ID: id }).post({ body: { version: current.version, actions: [{ action: 'setDefault', default: value }] } }).execute();
      return;
    } catch (error) {
      if (!isConflict(error) || attempt >= 1) throw error;
    }
  }
}

/** One default afterwards: every other default is cleared first, then this one is set. */
export async function setDefaultStored(customerId: string, methodId: string, root: Root = apiRoot): Promise<void> {
  const target = await ownMethod(root, customerId, methodId);
  for (const other of await activeMethods(root, customerId)) {
    if (other.id !== target.id && other.default) await setDefaultFlag(root, other.id, false);
  }
  await setDefaultFlag(root, target.id, true);
}

/** Deletes the method (current version). The default is not promoted to another method. */
export async function removeStored(customerId: string, methodId: string, root: Root = apiRoot): Promise<void> {
  const target = await ownMethod(root, customerId, methodId);
  try {
    await root.paymentMethods().withId({ ID: target.id }).delete({ queryArgs: { version: target.version } }).execute();
  } catch (error) {
    if (isNotFound(error)) return;
    if (!isConflict(error)) throw error;
    const fresh = await ownMethod(root, customerId, methodId);
    await root.paymentMethods().withId({ ID: fresh.id }).delete({ queryArgs: { version: fresh.version } }).execute();
  }
}
