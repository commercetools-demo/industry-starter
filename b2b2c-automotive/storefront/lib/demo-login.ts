// SPDX-License-Identifier: MIT
// Copyright (c) 2026 commercetools GmbH. Freely available, AS IS and UNSUPPORTED.
// Storefront demo login (`consumer-storefront/design-demo-login`, workstream Q-13a). Non-production only: `DEMO_LOGIN_ENABLED=true` and
// `NODE_ENV` not production; `scripts/check-no-demo-login.mjs` fails a production build that sets the flag. Lists the store's seeded demo
// shoppers (`malva-customer.isDemo`) as `{ id, label }` only and signs one in through N's `loginCustomer` (cart merge, sign-in hooks, session).
// The demo password (`DEMO_LOGIN_PASSWORD`, the seed's `SEED_DEMO_PASSWORD`) is read on the server and never leaves it.
import 'server-only';
import { ApiError } from '@/lib/api';
import { loginCustomer, type LoginResult } from '@/lib/auth/login';
import { apiRoot } from '@/lib/ct/client';
import { KEY_PATTERN } from '@/lib/ct/in-store';

export interface DemoShopper {
  id: string;
  label: string;
}
interface DemoCustomer extends DemoShopper {
  email: string;
}

export function isDemoLoginEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEMO_LOGIN_ENABLED === 'true' && env.NODE_ENV !== 'production';
}

/** "Make Model Year" of the active vehicle of the stored garage JSON, or null (light parse: the label is display only). */
function activeVehicleLabel(raw: unknown): string | null {
  try {
    const garage = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const { vehicles, activeId } = garage as { vehicles?: Array<{ id?: string; make?: string; model?: string; year?: number }>; activeId?: string };
    const vehicle = vehicles?.find((v) => v.id === activeId) ?? vehicles?.[0];
    if (!vehicle?.make || !vehicle.model) return null;
    return [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ');
  } catch {
    return null;
  }
}

async function loadDemoCustomers(storeKey: string): Promise<DemoCustomer[]> {
  if (!KEY_PATTERN.test(storeKey)) return [];
  const { body } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `stores(key="${storeKey}") and custom(fields(isDemo=true))`, sort: 'lastName asc', limit: 50 } })
    .execute();
  return body.results.map((c) => {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email;
    const vehicle = activeVehicleLabel(c.custom?.fields?.garage);
    return { id: c.id, email: c.email, label: vehicle ? `${name} · ${vehicle}` : name };
  });
}

/** Id and label only: no email, no password, no custom field. */
export async function listDemoShoppers(storeKey: string): Promise<DemoShopper[]> {
  return (await loadDemoCustomers(storeKey)).map(({ id, label }) => ({ id, label }));
}

/** Signs the listed demo shopper in with the demo password; an id outside the store's demo list is a 403 (logged, no session is touched). */
export async function demoSignIn(customerId: string, storeKey: string): Promise<LoginResult> {
  const customer = (await loadDemoCustomers(storeKey)).find((c) => c.id === customerId);
  if (!customer) {
    console.warn('[auth] demo login denied: the account is not a listed demo account of this store');
    throw new ApiError(403, 'Insufficient permissions to perform this task');
  }
  const password = process.env.DEMO_LOGIN_PASSWORD;
  if (!password) throw new ApiError(503, 'Demo login is not configured');
  return loginCustomer({ storeKey, email: customer.email, password });
}
