/**
 * Experiment: can a schema extension close the gaps in the core schema by calling the commercetools
 * HTTP API with its own client credentials (ctx.config), and can it key the data to the signed-in
 * shopper through federation entities (Customer.id, Product._ctId via @requires)?
 */
export const typeDefs = `
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.3", import: ["@key", "@external", "@requires"])

  type Query {
    "What config keys does the runtime hand the resolver? (names only, never values)"
    probeConfigKeys: [String!]!
    "Can a ROOT resolver see who is calling? (keys of ctx and the parent)"
    probeCtx: String!
    "Store list with coordinates and hours, read from supply channels (C2)."
    probeStores(country: String!): [ProbeStore!]!
  }

  type ProbeStore { key: String! name: String city: String hours: String }

  extend type Product @key(fields: "id") {
    id: ID! @external
    _ctId: ID! @external
    "Reviews of this product read from the HTTP API (D1). _ctId is the commercetools id."
    probeReviewCount: Int! @requires(fields: "_ctId")
  }

  extend type Customer @key(fields: "id") {
    id: ID! @external
    _ctId: ID! @external
    "Recurring orders of the signed-in customer read from the HTTP API (C1)."
    probeRecurringOrderCount: Int! @requires(fields: "_ctId")
  }
`;

interface Ctx { now(): number; config: Readonly<Record<string, string>>; }
interface Parent { id: string; _ctId?: string }

async function token(ctx: Ctx): Promise<string> {
  const basic = btoa(`${ctx.config.CTP_CLIENT_ID}:${ctx.config.CTP_CLIENT_SECRET}`);
  const res = await fetch(`${ctx.config.CTP_AUTH_URL}/oauth/token?grant_type=client_credentials`, {
    method: 'POST', headers: { authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`token ${res.status}`);
  return ((await res.json()) as { access_token: string }).access_token;
}

async function ct(ctx: Ctx, path: string): Promise<any> {
  const res = await fetch(`${ctx.config.CTP_API_URL}/${ctx.config.CTP_PROJECT_KEY}${path}`, {
    headers: { authorization: `Bearer ${await token(ctx)}` },
  });
  if (!res.ok) throw new Error(`ct ${path} ${res.status}`);
  return res.json();
}

export const resolvers = {
  Query: {
    probeConfigKeys: (_p: unknown, _a: unknown, ctx: Ctx) => Object.keys(ctx.config),
    probeCtx: (p: unknown, _a: unknown, ctx: Ctx) => JSON.stringify({ ctxKeys: Object.keys(ctx), parent: p ?? null }),
    probeStores: async (_p: unknown, { country }: { country: string }, ctx: Ctx) => {
      const r = await ct(ctx, `/channels?where=${encodeURIComponent('roles contains any ("InventorySupply")')}&limit=50`);
      return r.results.map((c: any) => ({ key: c.key, name: c.name?.['en-US'] ?? c.key, city: c.address?.city ?? null, hours: c.custom?.fields?.hours ?? null }))
        .filter((s: any) => !!country || s);
    },
  },
  Product: {
    probeReviewCount: async (p: Parent, _a: unknown, ctx: Ctx) => {
      const r = await ct(ctx, `/reviews?where=${encodeURIComponent(`target(typeId="product" and id="${p._ctId}")`)}&limit=1`);
      return r.total ?? 0;
    },
  },
  Customer: {
    probeRecurringOrderCount: async (c: Parent, _a: unknown, ctx: Ctx) => {
      const r = await ct(ctx, `/recurring-orders?where=${encodeURIComponent(`customer(id="${c._ctId}")`)}&limit=1`);
      return r.total ?? 0;
    },
  },
};
