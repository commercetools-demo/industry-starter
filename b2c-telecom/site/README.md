# Malva Telecom storefront

Next.js 16 (App Router) storefront on commercetools. Everything below runs in `site/` with Node 22 and npm only.

## Getting started

```bash
nvm use                       # Node 22, from ../.nvmrc
npm ci                        # install exactly what package-lock.json says
cp .env.example .env.local    # then fill in the values; never commit .env.local
npm run dev                   # http://localhost:3000
```

## Verify

```bash
npm run verify                # lockfile + version gates, lint, typecheck, tests, build
```

The order of the steps in `verify` is fixed (see `test/verify-script.test.ts`); each workstream inserts its own step at its position.

## More

The implementation plan, decisions and workstreams are in `../plan/README.md`.
