import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * D-036: the API client scopes are documented in `.env.example` (storefront) and `.env.seed.example` (seed admin client), one scope per
 * line with a reason. This test keeps those lists honest: every scope has a reason, none is listed twice, every resource the code calls
 * is covered by a listed scope, and the old name `manage_custom_objects` is gone.
 */
const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

/** `#   scope_name   reason` lines (the scope name first, at least two spaces before the reason). */
export function parseScopeLines(text: string): { scope: string; reason: string }[] {
  return text
    .split('\n')
    .map((line) => /^#\s{2,}((?:view|manage)_[a-z_]+)\s{2,}(\S.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ scope: m[1], reason: m[2].trim() }));
}

const storefront = parseScopeLines(read('.env.example'));
const seed = parseScopeLines(read('.env.seed.example'));
const storefrontNames = new Set(storefront.map((s) => s.scope));

const walk = (dir: string): string[] =>
  readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = path.join(dir, name);
    if (name === 'node_modules' || name === '.next') return [];
    return statSync(path.join(root, rel)).isDirectory() ? walk(rel) : [rel];
  });

describe('API client scopes (D-036)', () => {
  for (const [label, list] of [['.env.example (storefront client)', storefront], ['.env.seed.example (seed admin client)', seed]] as const) {
    it(`${label}: every scope has a reason and none is listed twice`, () => {
      expect(list.length).toBeGreaterThan(10);
      const names = list.map((s) => s.scope);
      expect(names.filter((n, i) => names.indexOf(n) !== i), 'listed twice').toEqual([]);
      for (const s of list) expect(s.reason.length, `${s.scope} needs a reason`).toBeGreaterThanOrEqual(15);
    });
  }

  it('the storefront list has the template baseline, the recurring-order scopes and Custom Objects (manage_key_value_documents, not manage_custom_objects)', () => {
    for (const name of [
      'view_published_products', 'view_products', 'view_categories', 'view_shipping_methods', 'manage_customers', 'manage_orders', 'manage_payments', 'manage_sessions',
      'manage_shopping_lists', 'manage_recurring_orders', 'view_recurrence_policies', 'manage_payment_methods', 'manage_key_value_documents', 'manage_checkout_payment_intents',
      'view_project_settings', 'view_states',
    ]) expect(storefrontNames.has(name), name).toBe(true);
    for (const file of ['.env.example', '.env.seed.example', 'scripts/seed/README.md']) {
      expect(read(file), file).not.toMatch(/manage_custom_objects(?!\))/);
    }
  });

  it('the storefront client has no admin scope (no manage_project, manage_products, manage_types ...)', () => {
    for (const forbidden of ['manage_project', 'manage_products', 'manage_types', 'manage_states', 'manage_categories', 'manage_stores', 'manage_zones', 'manage_customer_groups']) {
      expect(storefrontNames.has(forbidden), forbidden).toBe(false);
    }
  });

  it('every commercetools resource the storefront code calls is covered by a listed scope', () => {
    // resource collection on the API root -> scopes that grant it (any one is enough)
    const needs: Record<string, string[]> = {
      carts: ['manage_orders'], orders: ['manage_orders'], customers: ['manage_customers'], login: ['manage_customers'],
      customObjects: ['manage_key_value_documents'], shoppingLists: ['manage_shopping_lists'], recurringOrders: ['manage_recurring_orders'],
      payments: ['manage_payments'], paymentMethods: ['manage_payment_methods'], productProjections: ['view_published_products', 'view_products'],
      search: ['view_products'], inventory: ['view_products'], reviews: ['view_products'], categories: ['view_categories'], shippingMethods: ['view_shipping_methods'],
      products: ['view_products'], recurrencePolicies: ['view_recurrence_policies'], states: ['view_states'], zones: ['manage_orders'],
      taxCategories: ['view_tax_categories'], cartDiscounts: ['view_cart_discounts'], discountCodes: ['view_discount_codes'], types: ['view_types'],
      stores: ['view_stores'], channels: ['view_products'], productTypes: ['view_products'], messages: ['view_messages'],
    };
    // resources that would need a scope this list does not have: a new use must be reviewed (add the scope, or the mapping above)
    const unlisted = ['quotes', 'quoteRequests', 'stagedQuotes', 'businessUnits', 'standalonePrices', 'productSelections', 'customerGroups', 'extensions', 'subscriptions', 'importContainers', 'orderEdits'];
    const files = ['lib', 'app', 'netlify'].flatMap(walk).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.|fixtures?\.ts|test-/.test(f));
    const used = new Map<string, string>();
    const pattern = new RegExp(`\\.(${[...Object.keys(needs), ...unlisted].join('|')})\\(`, 'g');
    for (const file of files) {
      const text = read(file);
      if (!/apiRoot|root\b|api\b|inStore/.test(text)) continue;
      for (const m of text.matchAll(pattern)) if (!used.has(m[1])) used.set(m[1], file);
    }
    expect(used.size).toBeGreaterThan(8);
    const problems: string[] = [];
    for (const [resource, file] of used) {
      if (unlisted.includes(resource)) problems.push(`${resource} (${file}) is called but no scope for it is listed`);
      else if (!needs[resource].some((n) => storefrontNames.has(n))) problems.push(`${resource} (${file}) needs one of ${needs[resource].join(', ')}`);
    }
    expect(problems).toEqual([]);
  });

  it('plans/LIVE-TODOS.md section 3 and plans/notes/AC-todos.md name the same storefront scopes (skipped when the plans are not in the checkout)', () => {
    const plans = path.join(root, '..', 'plans');
    const live = path.join(plans, 'LIVE-TODOS.md');
    const ac = path.join(plans, 'notes', 'AC-todos.md');
    if (!existsSync(live) || !existsSync(ac)) return;
    const section = readFileSync(live, 'utf8').split('### 3.2')[0].split('## 3. API client scopes')[1] ?? '';
    const acText = readFileSync(ac, 'utf8');
    for (const name of storefrontNames) {
      expect(section, `LIVE-TODOS section 3.1 misses ${name}`).toContain(name);
      expect(acText, `AC-todos misses ${name}`).toContain(name);
    }
  });
});
