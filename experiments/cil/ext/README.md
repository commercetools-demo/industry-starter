# ext

A monorepo of commercetools Commerce Integration Layer extensions, scaffolded by
`commercetools integration-layer init`. Each extension is a workspace member under
`extensions/`; the starter one (`extensions/hello-world`) adds a `hello` field to
`Query`.

**One project, one bundle.** A Project deploys a single federation subgraph, so the
root scripts **merge** everything under `extensions/` into one artifact — never one per
package. Split your code into as many `extensions/*` packages as makes sense to author;
they always ship as one.

## Setup (once)

```sh
# The scripts below run through the commercetools CLI's integration-layer topic.
pnpm add -g @commercetools/cli
commercetools plugins install @commercetools/cli-topic-integration-layer

# Log in once — mints the manage_project token the authenticated commands reuse
commercetools auth login --project-key <your-project-key>

pnpm install
```

## Day to day

```sh
# From the repo root — these operate on the ONE combined bundle:
pnpm dev        # serve the merged subgraph behind a local federated gateway with the
                # Commerce Integration Layer, at http://localhost:4000/graphql. Needs a login.
pnpm test       # run every extension's unit tests (Vitest) — no login, no network
pnpm validate   # compose the combined bundle against your live schema (no upload)
pnpm push       # validate + upload it (replacing the Project's current bundle)

# …or iterate on one extension in isolation (standalone subgraph, no login needed):
pnpm --filter @extensions/hello-world dev
pnpm --filter @extensions/hello-world test
```

Resolvers, hooks, and API-extension handlers are plain functions, so you unit-test them
by calling them directly — see `extensions/hello-world/src/extension.test.ts` for the
pattern (a minimal fake for the host context, no gateway required).

With `pnpm dev` running, `/graphql` is the gateway, `/_extension` the raw combined
subgraph, and `/composed` the browsable merged schema.

To add an extension, copy `extensions/hello-world`, rename it in its `package.json`,
and edit its `src/extension.ts` (and the colocated `src/extension.test.ts`) — the root
scripts discover it automatically. Two extensions can each add fields to `Query`; they
only clash if they declare the *same* field.

Optionally copy `.env.example` to `.env` to override the Commerce Integration Layer edge URL.

## Documentation

- [Commerce Integration Layer documentation](https://docs.commercetools.com/commerce-integration-layer) —
  the authoring model: federation concepts, schema patterns, the entity catalog, the
  sandbox, configuration, and publishing.
- [Extension authoring details](https://github.com/commercetools/commerce-integration-layer-extensions/blob/main/docs/authoring.md)
  and the [CLI reference](https://github.com/commercetools/commerce-integration-layer-extensions/blob/main/docs/cli.md),
  alongside ready-to-edit templates for each pattern.
