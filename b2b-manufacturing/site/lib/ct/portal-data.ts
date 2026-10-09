import 'server-only';
import { apiRoot } from './client';

/** The Custom Object containers written by the seed (D5/Q-020). Keys are `<businessUnitKey>.<id>`. */
export const CONTAINERS = { visits: 'mpw-visits', wasteDocs: 'mpw-waste-docs', invoices: 'mpw-invoices' } as const;
export type Container = (typeof CONTAINERS)[keyof typeof CONTAINERS];

export interface VisitRecord { id: string; date: string; siteKey: string; serviceSlug: string; status: 'Scheduled' | 'In progress' | 'Completed' | 'Missed'; reportNumber: string }
export interface WasteDocRecord { id: string; date: string; siteKey: string; type: 'Waste transfer note' | 'Consignment note' | 'Annual report'; wasteType: string; number: string; recycledKg: number; totalKg: number }
export interface InvoiceRecord { id: string; number: string; date: string; siteKey: string; amountPence: number; status: 'Paid' | 'Due' | 'Overdue' }

const SAFE_KEY = /^[A-Za-z0-9_-]{1,256}$/;
const PAGE = 100;

/**
 * Every record of one Business Unit in a container. The key range `["<bu>.", "<bu>/")` is the prefix match (`like` is not
 * supported on Custom Object keys); the Business Unit always comes from the session, never from a request.
 */
export async function fetchRecords<T extends { id: string }>(container: Container, businessUnitKey: string): Promise<T[]> {
  if (!SAFE_KEY.test(businessUnitKey)) return [];
  const where = `key >= "${businessUnitKey}." and key < "${businessUnitKey}/"`;
  const out: T[] = [];
  for (let offset = 0; offset < 1000; offset += PAGE) {
    const { body } = await apiRoot.customObjects().withContainer({ container }).get({ queryArgs: { where, sort: 'key asc', limit: PAGE, offset } }).execute();
    out.push(...body.results.map((o) => o.value as T));
    if (body.results.length < PAGE) break;
  }
  return out;
}

/** Site key to site name, from the company's addresses (`company` holds the site name). */
export async function fetchSiteNames(businessUnitKey: string): Promise<Record<string, string>> {
  if (!SAFE_KEY.test(businessUnitKey)) return {};
  const { body } = await apiRoot.businessUnits().withKey({ key: businessUnitKey }).get().execute();
  const names: Record<string, string> = {};
  for (const a of body.addresses) if (a.key) names[a.key] = a.company ?? [a.streetName, a.city].filter(Boolean).join(', ') ?? a.key;
  return names;
}
