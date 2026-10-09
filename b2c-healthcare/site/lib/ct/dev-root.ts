import 'server-only';
import type { ByProjectKeyRequestBuilder } from '@commercetools/platform-sdk';
import { createFakeObjects, type FakeObjects } from '@/test/fake-custom-objects';
import { CONTAINERS } from '@/lib/ct/custom-objects';
import { BOOKINGS } from '@/scripts/seed/data/bookings';
import { LABS } from '@/scripts/seed/data/labs';
import { PATIENTS } from '@/scripts/seed/data/patients';
import { SCHEDULES } from '@/scripts/seed/data/schedules';

/**
 * Development-only stand-in for the commercetools client (`MALVA_FIXTURES=1`, see lib/ct/fixtures.ts `loadDevRoot`):
 * Custom Objects (schedules, labs, bookings, slot claims) and the Customer resource (patient reference, address
 * book) live in memory, so booking, the account area and the address book can be exercised in a browser without a
 * project. Nothing else is modelled. Never loaded in production. State sits on `globalThis` because pages and route
 * handlers are separate bundles in `next dev`.
 */

interface Addr { id: string; key?: string; [k: string]: unknown }
interface Cust { id: string; version: number; email: string; firstName: string; lastName: string; addresses: Addr[]; defaultShippingAddressId?: string; custom: { fields: { patientRef: string } } }

interface Store { objects: FakeObjects; customers: Map<string, Cust>; seq: number }
const g = globalThis as unknown as { __malvaDevRoot?: Store };

function build(): Store {
  const objects = createFakeObjects();
  const now = new Date().toISOString();
  let n = 0;
  const add = (container: string, key: string, value: unknown) =>
    objects.objects.push({ id: `seed-${(n += 1)}`, container, key, version: 1, value: structuredClone(value), createdAt: now, lastModifiedAt: now });
  for (const s of SCHEDULES) add(CONTAINERS.schedule, s.doctorKey, s.schedule);
  for (const l of LABS) add(CONTAINERS.lab, l.id, l);
  for (const b of BOOKINGS) add(CONTAINERS.booking, b.reference, b);
  return { objects, customers: new Map(), seq: 0 };
}
const store = (): Store => (g.__malvaDevRoot ??= build());

const err = (statusCode: number) => Object.assign(new Error(String(statusCode)), { statusCode, code: statusCode });

function customerOf(s: Store, id: string): Cust {
  const held = s.customers.get(id);
  if (held) return held;
  const p = PATIENTS.find((x) => `fixture-${x.slug}` === id);
  if (!p) throw err(404);
  const home: Addr = { id: `addr-${p.slug}`, key: `home-${p.slug}`, country: 'US', firstName: p.firstName, lastName: p.lastName, ...p.address };
  const c: Cust = { id, version: 1, email: p.email, firstName: p.firstName, lastName: p.lastName, addresses: [home], defaultShippingAddressId: home.id, custom: { fields: { patientRef: p.patientRef } } };
  s.customers.set(id, c);
  return c;
}

type Action = { action: string; address?: Record<string, unknown>; addressKey?: string; addressId?: string };

function apply(s: Store, c: Cust, actions: Action[]): void {
  for (const a of actions) {
    const idOf = (): string | undefined => a.addressId ?? c.addresses.find((x) => a.addressKey !== undefined && x.key === a.addressKey)?.id;
    if (a.action === 'addAddress') c.addresses.push({ ...(a.address ?? {}), id: `addr-${(s.seq += 1)}` });
    else if (a.action === 'changeAddress') {
      const i = c.addresses.findIndex((x) => x.id === a.addressId);
      if (i < 0) throw err(400);
      c.addresses[i] = { ...(a.address ?? {}), id: a.addressId as string };
    } else if (a.action === 'removeAddress') {
      c.addresses = c.addresses.filter((x) => x.id !== a.addressId);
      if (c.defaultShippingAddressId === a.addressId) delete c.defaultShippingAddressId;
    } else if (a.action === 'setDefaultShippingAddress') {
      const id = idOf();
      if (id) c.defaultShippingAddressId = id;
      else delete c.defaultShippingAddressId;
    }
    // addShippingAddressId and the rest are accepted and ignored.
  }
  c.version += 1;
}

/** The fake root: only `customObjects()` and `customers()` exist. */
export function createDevRoot(): ByProjectKeyRequestBuilder {
  const s = store();
  const root = {
    customObjects: () => (s.objects.customObjects as () => unknown)(),
    customers: () => ({
      withId: ({ ID }: { ID: string }) => ({
        get: () => ({ execute: async () => ({ body: structuredClone(customerOf(s, ID)) }) }),
        post: ({ body }: { body: { version: number; actions: Action[] } }) => ({
          execute: async () => {
            const c = customerOf(s, ID);
            if (body.version !== c.version) throw err(409);
            apply(s, c, body.actions);
            return { body: structuredClone(c) };
          },
        }),
      }),
    }),
  };
  return root as unknown as ByProjectKeyRequestBuilder;
}
