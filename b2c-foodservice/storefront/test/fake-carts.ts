import type { InventoryDetail } from '@/lib/types';

/**
 * An in-memory commercetools cart engine for server tests (workstream I). It understands the update actions the storefront
 * sends and returns carts with line totals, shipping and tax, so tests can assert on the actions posted and on the totals
 * read back. Install with:
 *
 *   vi.mock('@/lib/ct/client', async () => (await import('@/test/fake-carts')).clientModule());
 *   vi.mock('@/lib/ct/inventory', async () => (await import('@/test/fake-carts')).inventoryModule());
 */
type Obj = Record<string, unknown>;
export interface FakeUpdate { id: string; version: number; actions: Obj[] }

export interface FakeCode { id: string; reject?: string; minNet?: number; percent?: number }

export const fake = {
  carts: new Map<string, Obj>(),
  updates: [] as FakeUpdate[],
  /** Reads (GET) of carts. */
  reads: 0,
  conflicts: 0,
  n: 0,
  /** Thrown by every cart read when set (an upstream outage). */
  readError: undefined as unknown,
  /** Current catalogue price per SKU in minor units; a missing SKU is unknown, 0 or null means no price. */
  prices: {} as Record<string, number | null>,
  /** Prices in CAD when they differ from `prices` (a null or 0 entry means no CAD price). */
  cadPrices: {} as Record<string, number | null>,
  codes: {} as Record<string, FakeCode>,
  stock: {} as Record<string, InventoryDetail>,
  /** Shipping: standard rate and free-above threshold (net lines), minor units. */
  shipRate: 695,
  freeAbove: 7500,
  taxPercent: 8,
  reset() {
    this.carts.clear();
    this.updates = [];
    this.reads = 0;
    this.conflicts = 0;
    this.readError = undefined;
    this.n = 0;
    this.prices = {};
    this.cadPrices = {};
    this.codes = {};
    this.stock = {};
  },
};

const money = (centAmount: number, currencyCode: string) => ({ type: 'centPrecision', centAmount, currencyCode, fractionDigits: 2 });
const err = (statusCode: number, errors: Obj[]) => Object.assign(new Error('ct'), { statusCode, body: { statusCode, errors } });

interface Line extends Obj {
  id: string; quantity: number; variant: { sku: string }; price: { value: ReturnType<typeof money> }; totalPrice: ReturnType<typeof money>;
  custom?: { fields: Obj }; supplyChannel?: { typeId: string; id: string }; recurrenceInfo?: { recurrencePolicy: { id: string } };
  key?: string; priceMode?: string; shippingDetails?: Obj;
}

/** Lines merge like the platform: same SKU, fulfilment, store, recurrence and parent; a keyed line (a bundle) never merges (workstream V). */
function sameLine(l: Line, a: Obj): boolean {
  const fields = (a.custom as { fields?: Obj } | undefined)?.fields;
  return (
    l.variant.sku === a.sku && l.custom?.fields?.fulfilment === fields?.fulfilment &&
    l.supplyChannel?.id === (a.supplyChannel as { id?: string } | undefined)?.id &&
    l.recurrenceInfo?.recurrencePolicy.id === (a.recurrenceInfo as { recurrencePolicy?: { id: string } } | undefined)?.recurrencePolicy?.id &&
    (l.custom?.fields?.parentId ?? null) === (fields?.parentId ?? null) && !a.key && !l.key
  );
}

function reprice(cart: Obj): void {
  const lines = cart.lineItems as Line[];
  const currency = (cart.totalPrice as { currencyCode: string }).currencyCode;
  for (const l of lines) l.totalPrice = money(l.price.value.centAmount * l.quantity, currency);
  let net = lines.reduce((n, l) => n + l.totalPrice.centAmount, 0);
  for (const info of (cart.discountCodes as Obj[]) ?? []) {
    const code = Object.values(fake.codes).find((c) => c.id === (info.discountCode as { id: string }).id);
    info.state = code?.minNet !== undefined && net < code.minNet ? 'DoesNotMatchCart' : 'MatchesCart';
    if (info.state === 'MatchesCart' && code?.percent) net -= Math.round((net * code.percent) / 100);
  }
  cart.totalLineItemQuantity = lines.reduce((n, l) => n + l.quantity, 0);
  if (cart.shippingMode === 'Multiple') return repriceMultiple(cart, lines, net, currency);
  const info = cart.shippingInfo as { price: ReturnType<typeof money> } | undefined;
  if (info) info.price = money(net >= fake.freeAbove ? 0 : fake.shipRate, currency);
  const shipping = info?.price.centAmount ?? 0;
  const tax = Math.round(((net + shipping) * fake.taxPercent) / 100);
  cart.totalPrice = money(net + shipping, currency);
  cart.taxedPrice = { totalNet: money(net + shipping, currency), totalGross: money(net + shipping + tax, currency), totalTax: money(tax, currency), taxPortions: [] };
}

interface Entry extends Obj { shippingKey: string; shippingInfo: { price: ReturnType<typeof money> }; shippingMethod: { key: string } }

/** True when every unit of every line is allocated to an entry the cart has: summed target quantity, not `valid` (verified live). */
function fullyAllocated(cart: Obj, lines: Line[]): boolean {
  const keys = ((cart.shipping as Entry[]) ?? []).map((e) => e.shippingKey);
  return lines.length > 0 && lines.every((l) => {
    const targets = (l.shippingDetails as { targets: { quantity: number; shippingMethodKey: string }[] } | undefined)?.targets ?? [];
    return targets.reduce((n, t) => n + t.quantity, 0) === l.quantity && targets.every((t) => keys.includes(t.shippingMethodKey));
  });
}

/** `Multiple` mode like the platform: each entry is priced (collect free, delivery by the whole cart's net), tax only once fully allocated. */
function repriceMultiple(cart: Obj, lines: Line[], net: number, currency: string): void {
  const entries = (cart.shipping as Entry[]) ?? [];
  for (const e of entries) {
    const used = lines.some((l) => ((l.shippingDetails as { targets: { shippingMethodKey: string }[] } | undefined)?.targets ?? []).some((t) => t.shippingMethodKey === e.shippingKey));
    e.shippingInfo.price = money(!used || e.shippingMethod.key === 'mcf-collect' || net >= fake.freeAbove ? 0 : fake.shipRate, currency);
  }
  for (const l of lines) {
    const d = l.shippingDetails as { targets: { quantity: number; shippingMethodKey: string }[]; valid?: boolean } | undefined;
    if (d) d.valid = d.targets.every((t) => entries.some((e) => e.shippingKey === t.shippingMethodKey));
  }
  const allocated = fullyAllocated(cart, lines);
  const shipping = allocated ? entries.reduce((n, e) => n + e.shippingInfo.price.centAmount, 0) : 0;
  cart.totalPrice = money(net + shipping, currency);
  if (!allocated) {
    delete cart.taxedPrice;
    return;
  }
  const tax = Math.round(((net + shipping) * fake.taxPercent) / 100);
  cart.taxedPrice = { totalNet: money(net + shipping, currency), totalGross: money(net + shipping + tax, currency), totalTax: money(tax, currency), taxPortions: [] };
}

function apply(cart: Obj, action: Obj): void {
  const lines = cart.lineItems as Line[];
  const currency = (cart.totalPrice as { currencyCode: string }).currencyCode;
  const line = () => {
    const found = lines.find((l) => l.id === action.lineItemId);
    if (!found) throw err(400, [{ code: 'InvalidOperation', message: 'line not found' }]);
    return found;
  };
  switch (action.action) {
    case 'addLineItem': {
      // An external price (a bundle parent or part, workstream V) is the price the line carries; the SKU's own price is not read.
      const external = action.externalPrice as { centAmount: number } | undefined;
      const price = external ? external.centAmount : priceFor(action.sku as string, currency);
      if (price === undefined) throw err(400, [{ code: 'InvalidOperation', message: `A product with SKU '${String(action.sku)}' not found.` }]);
      if (price === null) throw err(400, [{ code: 'MissingPriceForProduct', message: 'no price' }]);
      const existing = lines.find((l) => sameLine(l, action));
      if (existing) existing.quantity += action.quantity as number;
      else {
        fake.n += 1;
        lines.push({
          id: `li-${fake.n}`, productId: `p-${String(action.sku)}`, quantity: action.quantity as number, variant: { sku: action.sku as string },
          name: { 'en-US': `Product ${String(action.sku)}` }, productSlug: { 'en-US': `slug-${String(action.sku)}` },
          price: { value: money(price, currency) }, totalPrice: money(0, currency),
          taxRate: { includedInPrice: false },
          ...(external ? { priceMode: 'ExternalPrice' } : {}),
          ...(action.key ? { key: action.key as string } : {}),
          custom: action.custom as { fields: Obj },
          ...(action.supplyChannel ? { supplyChannel: action.supplyChannel as { typeId: string; id: string } } : {}),
          ...(action.recurrenceInfo ? { recurrenceInfo: action.recurrenceInfo as { recurrencePolicy: { id: string } } } : {}),
        } as Line);
      }
      break;
    }
    case 'changeLineItemQuantity': line().quantity = action.quantity as number; break;
    case 'removeLineItem': {
      const found = line();
      lines.splice(lines.indexOf(found), 1);
      break;
    }
    case 'setLineItemSupplyChannel': {
      const l = line();
      if (action.supplyChannel) l.supplyChannel = action.supplyChannel as { typeId: string; id: string };
      else delete l.supplyChannel;
      break;
    }
    case 'setLineItemPrice': {
      const l = line();
      const external = action.externalPrice as { centAmount: number } | undefined;
      if (external) {
        l.priceMode = 'ExternalPrice';
        l.price = { value: money(external.centAmount, currency) };
      } else {
        delete l.priceMode;
        const p = priceFor(l.variant.sku, currency);
        if (p) l.price = { value: money(p, currency) };
      }
      break;
    }
    case 'setLineItemCustomField': {
      const l = line();
      l.custom = { fields: { ...(l.custom?.fields ?? {}), [action.name as string]: action.value } };
      break;
    }
    case 'setShippingMethod':
      cart.shippingInfo = {
        shippingMethodName: 'Standard', shippingMethodState: 'MatchesCart', price: money(fake.shipRate, currency),
        shippingMethod: { typeId: 'shipping-method', id: `sm-${String((action.shippingMethod as { key: string }).key)}`, obj: { key: (action.shippingMethod as { key: string }).key } },
      };
      break;
    case 'addItemShippingAddress': {
      const list = (cart.itemShippingAddresses as Obj[]) ?? (cart.itemShippingAddresses = []);
      const address = action.address as Obj;
      if (list.some((a) => a.key === address.key)) throw err(400, [{ code: 'InvalidOperation', message: 'duplicate address key' }]);
      list.push({ ...address });
      break;
    }
    case 'removeItemShippingAddress': {
      const key = action.addressKey as string;
      if (lines.some((l) => ((l.shippingDetails as { targets: { addressKey: string }[] } | undefined)?.targets ?? []).some((t) => t.addressKey === key))) {
        throw err(400, [{ code: 'InvalidOperation', message: 'address is used by a line target' }]);
      }
      cart.itemShippingAddresses = ((cart.itemShippingAddresses as Obj[]) ?? []).filter((a) => a.key !== key);
      break;
    }
    case 'addShippingMethod': {
      const list = (cart.shipping as Obj[]) ?? (cart.shipping = []);
      const key = action.shippingKey as string;
      if (list.some((e) => e.shippingKey === key)) throw err(400, [{ code: 'InvalidOperation', message: 'duplicate shipping key' }]);
      const methodKey = (action.shippingMethod as { key: string }).key;
      list.push({
        shippingKey: key, shippingAddress: { ...(action.shippingAddress as Obj) }, shippingMethod: { typeId: 'shipping-method', key: methodKey },
        shippingInfo: {
          shippingMethodName: methodKey, shippingMethodState: 'MatchesCart', price: money(0, currency),
          shippingMethod: { typeId: 'shipping-method', id: `sm-${methodKey}`, obj: { key: methodKey } },
        },
      });
      break;
    }
    case 'removeShippingMethod': {
      const key = action.shippingKey as string;
      if (lines.some((l) => ((l.shippingDetails as { targets: { shippingMethodKey: string }[] } | undefined)?.targets ?? []).some((t) => t.shippingMethodKey === key))) {
        throw err(400, [{ code: 'InvalidOperation', message: 'shipping method is used by a line target' }]);
      }
      cart.shipping = ((cart.shipping as Obj[]) ?? []).filter((e) => e.shippingKey !== key);
      break;
    }
    case 'setLineItemShippingDetails': {
      const l = line();
      const d = action.shippingDetails as { targets: Obj[] } | undefined;
      const addresses = (cart.itemShippingAddresses as Obj[]) ?? [];
      for (const t of d?.targets ?? []) {
        if (!addresses.some((a) => a.key === t.addressKey)) throw err(400, [{ code: 'InvalidOperation', message: 'unknown address key' }]);
      }
      if (d) l.shippingDetails = { targets: d.targets.map((t) => ({ ...t })), valid: true };
      else delete l.shippingDetails;
      break;
    }
    case 'recalculate':
      for (const l of lines) {
        const p = priceFor(l.variant.sku, currency);
        // A line with an external price keeps it (F-V-03).
        if (p && !l.recurrenceInfo && l.priceMode !== 'ExternalPrice') l.price = { value: money(p, currency) };
      }
      break;
    case 'addDiscountCode': {
      const code = fake.codes[action.code as string];
      if (!code) throw err(400, [{ code: 'DiscountCodeNonApplicable', reason: 'DoesNotExist', message: 'x' }]);
      if (code.reject) throw err(400, [{ code: 'DiscountCodeNonApplicable', reason: code.reject, message: 'x' }]);
      const net = lines.reduce((n, l) => n + l.price.value.centAmount * l.quantity, 0);
      if (code.minNet !== undefined && net < code.minNet) throw err(400, [{ code: 'DiscountCodeNonApplicable', reason: 'DoesNotMatchCart', message: 'x' }]);
      const list = (cart.discountCodes as Obj[]) ?? (cart.discountCodes = []);
      list.push({ discountCode: { typeId: 'discount-code', id: code.id, obj: { id: code.id, code: action.code } }, state: 'MatchesCart' });
      break;
    }
    case 'removeDiscountCode':
      cart.discountCodes = ((cart.discountCodes as Obj[]) ?? []).filter((d) => (d.discountCode as { id: string }).id !== (action.discountCode as { id: string }).id);
      break;
    case 'setDeleteDaysAfterLastModification': cart.deleteDaysAfterLastModification = action.deleteDaysAfterLastModification; break;
    default: throw err(400, [{ code: 'InvalidOperation', message: `unsupported ${String(action.action)}` }]);
  }
}

function priceFor(sku: string, currency: string): number | null | undefined {
  return currency === 'CAD' && sku in fake.cadPrices ? fake.cadPrices[sku] : fake.prices[sku];
}

const copy = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function clientModule() {
  return {
    projectKey: 'test',
    apiRoot: {
      carts: () => ({
        post: ({ body }: { body: Obj }) => ({
          execute: async () => {
            fake.n += 1;
            const cart: Obj = {
              id: `cart-${fake.n}`, version: 1, cartState: 'Active', lineItems: [], discountCodes: [], totalLineItemQuantity: 0,
              shipping: [], itemShippingAddresses: [], totalPrice: money(0, body.currency as string), ...body,
            };
            fake.carts.set(cart.id as string, cart);
            return { body: copy(cart) };
          },
        }),
        withId: ({ ID }: { ID: string }) => ({
          get: () => ({
            execute: async () => {
              fake.reads += 1;
              if (fake.readError) throw fake.readError;
              const c = fake.carts.get(ID);
              if (!c) throw Object.assign(new Error('nf'), { statusCode: 404 });
              return { body: copy(c) };
            },
          }),
          post: ({ body }: { body: { version: number; actions: Obj[] } }) => ({
            execute: async () => {
              fake.updates.push({ id: ID, version: body.version, actions: body.actions });
              const c = fake.carts.get(ID);
              if (!c) throw Object.assign(new Error('nf'), { statusCode: 404 });
              if (fake.conflicts > 0) {
                fake.conflicts -= 1;
                c.version = (c.version as number) + 1; // someone else wrote in between
                throw err(409, [{ code: 'ConcurrentModification' }]);
              }
              if (body.version !== c.version) throw err(409, [{ code: 'ConcurrentModification' }]);
              const next = copy(c);
              for (const a of body.actions) apply(next, a);
              reprice(next);
              next.version = (c.version as number) + 1;
              fake.carts.set(ID, next);
              return { body: copy(next) };
            },
          }),
        }),
      }),
    },
  };
}

export function inventoryModule() {
  return {
    SKU_PATTERN: /^[A-Za-z0-9._-]{1,64}$/,
    getInventoryDetail: async (skus: string[]) => Object.fromEntries(skus.filter((s) => fake.stock[s]).map((s) => [s, fake.stock[s]])),
    getStoreStock: async (sku: string, channelId: string) => fake.stock[sku]?.stores[channelId] ?? 0,
  };
}

/** Puts a ready cart into the fake engine and returns its id. */
export function seedCart(over: Obj = {}): string {
  fake.n += 1;
  const id = `cart-${fake.n}`;
  const cart: Obj = {
    id, version: 1, cartState: 'Active', country: 'US', locale: 'en-US', shippingMode: 'Multiple', anonymousId: 'anon-1', lineItems: [],
    discountCodes: [], totalLineItemQuantity: 0, totalPrice: money(0, 'USD'), ...over,
  };
  reprice(cart);
  fake.carts.set(id, cart);
  return id;
}
