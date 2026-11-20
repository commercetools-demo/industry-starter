/**
 * A hello-world integration-layer extension — the PURELY ADDITIVE pattern: it adds a
 * brand-new root field (`Query.hello`) and shares nothing with the Commerce Integration Layer,
 * so the two `Query` types merge with no change to it and composition is trivial.
 *
 * An extension exports `typeDefs` (a federation-v2 SDL string) + `resolvers` and runs
 * in a restricted runtime. Edit this file, then from the repo ROOT run `pnpm validate` /
 * `pnpm push` — every extension is merged into the one bundle the project deploys (the
 * target project comes from your `commercetools auth login`). Iterate on just this one
 * with `pnpm --filter @extensions/hello-world dev`.
 */

export const typeDefs = `
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.3")

  type Query {
    "A friendly greeting contributed by this extension."
    hello(name: String): String!
  }
`;

/**
 * The per-call capability context the restricted runtime hands each resolver.
 * `now()` is the current epoch millis (a convenience — `Date.now()` works too);
 * `config` is this extension's merchant-supplied `{ key: value }` map, with secret
 * values decrypted host-side (e.g. `ctx.config.API_KEY`). Set values with
 * `commercetools integration-layer config set <KEY> <VALUE>`.
 */
interface ExtensionContext {
  now(): number;
  config: Readonly<Record<string, string>>;
}

export const resolvers = {
  Query: {
    // A resolver receives (parent, args, context): `_parent` is the object the field
    // hangs off (nothing here — this is a root field), `args` are the field arguments
    // from the query, and `ctx` exposes the restricted runtime's host capabilities.
    hello: (_parent: unknown, { name }: { name?: string }, ctx: ExtensionContext) => {
      const greeting = ctx.config.GREETING ?? "Hello";
      return `${greeting}, ${name ?? "world"}, from your integration-layer extension!`;
    },
  },
};
