// Sample customers offered by the demo sign-in on the login page. Mirrors scripts/seed/data/demo/customers.ts (emails only; the
// password is the server env SEED_DEMO_PASSWORD and never reaches the browser).
export interface DemoLoginCustomer {
  email: string;
  name: string;
  group: string;
}

export const DEMO_LOGIN_CUSTOMERS: readonly DemoLoginCustomer[] = [
  { email: 'alex.rivera@example.com', name: 'Alex Rivera', group: 'existing customer' },
  { email: 'jo.kim@example.com', name: 'Jo Kim', group: 'existing customer' },
  { email: 'sam.carter@example.com', name: 'Sam Carter', group: 'small business' },
  { email: 'pat.lee@example.com', name: 'Pat Lee', group: 'employee' },
  { email: 'lena.weber@example.de', name: 'Lena Weber', group: 'consumer' },
];

/** On outside production; in production only with DEMO_SHOW_LOGIN=true. Always needs SEED_DEMO_PASSWORD on the server. */
export function demoLoginEnabled(): boolean {
  if (!process.env.SEED_DEMO_PASSWORD) return false;
  return process.env.NODE_ENV !== 'production' || process.env.DEMO_SHOW_LOGIN === 'true';
}
