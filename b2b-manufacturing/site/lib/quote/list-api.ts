import 'server-only';
import { ApiError, handle, ok, parseBody } from '../api';
import { fetchAllServices } from '../ct/services';
import { addService, isAssociate, type ListState } from '../ct/quote-list';
import { getSession } from '../session';
import { addLineSchema } from './schemas';
import type { Service } from '../types';
import { persistList, sessionFor } from './session';
import type { Session } from '../session-core';

const TTL = 30_000;
const memo = new Map<string, { at: number; services: Promise<Service[]> }>();
/** The catalogue a list is checked against ("no longer available", frequencies). 30 s is long enough to spare Product Search on every click. */
export function servicesFor(locale: string): Promise<Service[]> {
  const hit = memo.get(locale);
  if (hit && Date.now() - hit.at < TTL) return hit.services;
  const services = fetchAllServices(locale);
  memo.set(locale, { at: Date.now(), services });
  services.catch(() => memo.delete(locale));
  return services;
}
export const clearServicesMemo = (): void => memo.clear();

type Outcome = ListState & { alreadyInList?: boolean };

/** Shared by the list routes: the effective session, the catalogue, the operation, the cookie and the JSON body (the full list, so the hook can set its cache from it). */
export async function withList(request: Request, run: (session: Session, services: Service[]) => Promise<Outcome>, options: { readOnly?: boolean } = {}): Promise<Response> {
  const original = await getSession();
  const session = await sessionFor(request.headers.get('x-malva-locale'));
  if (options.readOnly && !session.cartId && !isAssociate(session)) {
    await persistList(original, session, undefined);
    return ok({ id: null, lines: [], count: 0 });
  }
  const result = await run(session, await servicesFor(session.locale));
  await persistList(original, session, result.cartId);
  return ok({ ...result.list, ...(result.rebuilt ? { rebuilt: true } : {}), ...(result.alreadyInList ? { alreadyInList: true } : {}) });
}

/** Add a service: `{ serviceId | serviceSlug, frequency?, note? }`. Answers with the full list; a second add of the same service changes nothing and says `alreadyInList`. */
export const addLineHandler = handle(async (request: Request) => {
  const body = await parseBody(request, addLineSchema);
  const id = body.serviceId;
  const slug = body.serviceSlug;
  const frequency = body.frequency || undefined;
  return withList(request, async (session, services) => {
    const service = services.find((s) => (id ? s.id === id : s.slug === slug));
    if (!service) throw new ApiError(404, 'We could not find that service.');
    return addService(session, service, services, { frequency, note: body.note });
  });
});
