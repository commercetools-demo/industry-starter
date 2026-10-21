import 'server-only';

/**
 * The seeded demo customers (seed/src/data/customers.ts, SEED-PLAN section 13). Server only: the emails live here and
 * never reach the browser. A test compares this list with the seed's keys, emails and names.
 */
export interface DemoCustomer {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  country: 'US' | 'CA';
}

export const DEMO_CUSTOMERS: readonly DemoCustomer[] = [
  { key: 'mcf-customer-maya', email: 'maya.okonkwo@example.com', firstName: 'Maya', lastName: 'Okonkwo', country: 'US' },
  { key: 'mcf-customer-liam', email: 'liam.carter@example.com', firstName: 'Liam', lastName: 'Carter', country: 'US' },
  { key: 'mcf-customer-priya', email: 'priya.nair@example.com', firstName: 'Priya', lastName: 'Nair', country: 'CA' },
  { key: 'mcf-customer-lucas', email: 'lucas.tremblay@example.com', firstName: 'Lucas', lastName: 'Tremblay', country: 'CA' },
  { key: 'mcf-customer-ava', email: 'ava.mackenzie@example.com', firstName: 'Ava', lastName: 'MacKenzie', country: 'CA' },
  { key: 'mcf-customer-noah', email: 'noah.patel@example.com', firstName: 'Noah', lastName: 'Patel', country: 'US' },
];

/** D-040: on only when `DEMO_LOGIN_ENABLED` is `true` and the shared demo password is configured. */
export function demoLoginEnabled(): boolean {
  return process.env.DEMO_LOGIN_ENABLED === 'true' && Boolean(process.env.DEMO_LOGIN_PASSWORD);
}

export interface DemoListItem { key: string; name: string; market: 'US' | 'CA' }

/** Names and markets only: no email, no password. */
export function listDemoCustomers(): DemoListItem[] {
  return DEMO_CUSTOMERS.map((c) => ({ key: c.key, name: `${c.firstName} ${c.lastName}`, market: c.country }));
}

/** The sign-in pair for a key, or null when the key is unknown or demo login is off. */
export function demoCredentials(key: string): { email: string; password: string } | null {
  if (!demoLoginEnabled()) return null;
  const customer = DEMO_CUSTOMERS.find((c) => c.key === key);
  const password = process.env.DEMO_LOGIN_PASSWORD;
  return customer && password ? { email: customer.email, password } : null;
}
