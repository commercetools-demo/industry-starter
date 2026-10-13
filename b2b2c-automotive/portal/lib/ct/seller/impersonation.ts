// "Shop as customer", portal side (workstream V-06). Admin only. The customer is read through the in-store endpoint (another store's
// customer is 404), a single-use record `malva-impersonation/<jti>` is written, and a 60 second token is signed for the storefront.
// The storefront landing (`/api/impersonate`) is not built yet, see plans/MISSED-FEATURES.md for its exact contract.
import 'server-only';
import { CatalogError } from '@/lib/catalog/errors';
import { SecretMissingError, signHandoff } from '@/lib/impersonation/token';
import { customerForShopAs } from './customers';
import { V_CONTAINERS, createObject, listObjects, upsertObject } from './v-objects';

export interface ImpersonationRecord {
  customerId: string;
  storeKey: string;
  actorId: string;
  createdAt: string;
  status: 'issued' | 'active' | 'ended';
}

export async function startShopAs(storeKey: string, customerId: string, actorId: string, now: Date = new Date(), secret?: string): Promise<{ token: string; name: string; jti: string }> {
  const customer = await customerForShopAs(storeKey, customerId);
  let signed: Awaited<ReturnType<typeof signHandoff>>;
  try {
    signed = await signHandoff({ customerId: customer.id, storeKey, actorId }, { now, ...(secret ? { secret } : {}) });
  } catch (error) {
    if (error instanceof SecretMissingError) throw new CatalogError(409, 'NOT_CONFIGURED', 'Shop as customer is not set up for this portal');
    throw error;
  }
  const record: ImpersonationRecord = { customerId: customer.id, storeKey, actorId, createdAt: now.toISOString(), status: 'issued' };
  await createObject(V_CONTAINERS.impersonation, () => signed.jti, record, 1);
  return { token: signed.token, name: customer.name, jti: signed.jti };
}

/** Marks every issued or active handoff record of this seller in this store as ended (portal "Exit customer session"). */
export async function endShopAs(storeKey: string, actorId: string): Promise<number> {
  const records = await listObjects<ImpersonationRecord>(V_CONTAINERS.impersonation, `value(actorId="${actorId.replace(/["\\]/g, '')}")`);
  let ended = 0;
  for (const r of records) {
    if (r.value.storeKey !== storeKey || r.value.status === 'ended') continue;
    await upsertObject<ImpersonationRecord>(V_CONTAINERS.impersonation, r.key, (current) => ({ ...(current ?? r.value), status: 'ended' }));
    ended += 1;
  }
  return ended;
}
