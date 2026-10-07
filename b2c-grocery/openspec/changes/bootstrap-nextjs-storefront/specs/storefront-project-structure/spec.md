## ADDED Requirements

### Requirement: Repository and app layout

The repository SHALL keep `openspec/`, `design/` and root deploy files at the root and the application in `site/`. Inside `site/` the layout SHALL be: `app/` (`layout.tsx`, `[locale]/`, `api/`), `lib/` (`ct/`, `mappers/`, `session.ts`, `types.ts`, `cache-keys.ts`, `utils.ts`), `hooks/`, `context/`, `components/{ui,layout,product}/`, `i18n/` (`routing.ts`, `request.ts`), `messages/`, `proxy.ts`, `next.config.ts` and `postcss.config.mjs`.

#### Scenario: Scaffold complete
- **WHEN** bootstrap finishes
- **THEN** every listed path exists and `npm run build` succeeds

### Requirement: Layering and import rules

Modules under `lib/ct/` SHALL be server-only and SHALL NOT be imported from any `'use client'` module. Components SHALL import types only from `lib/types.ts`, never from `lib/ct/*` or SDK packages. Only `lib/ct/client.ts` SHALL construct `ClientBuilder`. Every module in `lib/ct/`, `lib/mappers/` and `lib/session.ts` SHALL begin with `import 'server-only'` so that a client-side import fails the build.

#### Scenario: Client importing server code
- **WHEN** a `'use client'` file imports from `@/lib/ct/*`
- **THEN** lint fails the build

#### Scenario: SDK types in a component
- **WHEN** a component imports from `@commercetools/platform-sdk`
- **THEN** lint fails and the type is replaced by an app type mapped in `lib/mappers/`

### Requirement: Route organization

Locale-prefixed UI SHALL live under `app/[locale]/`. BFF Route Handlers SHALL live under `app/api/` (`auth`, `account`, `cart`, `checkout`, `locale` and the development-only `health`) as `route.ts`. Each locale segment SHALL provide `error.tsx` and `not-found.tsx`.

#### Scenario: Unknown product
- **WHEN** a product slug does not exist
- **THEN** the page calls `notFound()` and `not-found.tsx` renders with a path back to the shop

### Requirement: Navigation and error-handling idioms

Locale-aware UI SHALL import `Link`, `useRouter`, `redirect` and `usePathname` from `@/i18n/routing`, not from `next/link` or `next/navigation`. `redirect()`, `notFound()`, `forbidden()` and `unauthorized()` SHALL be called outside `try/catch`, or the error SHALL be re-thrown with `unstable_rethrow`. Dynamic `params` and `searchParams` SHALL be awaited.

#### Scenario: Redirect in try block
- **WHEN** code wraps `redirect()` in `try/catch` without `unstable_rethrow`
- **THEN** review/lint rejects it

### Requirement: Server and client component boundary

Pages and layouts SHALL be Server Components by default; `'use client'` SHALL be limited to interactive leaves, and function props SHALL NOT cross from server to client components. `metadata` and `generateMetadata` SHALL only be exported from Server Components, and a fetch shared by metadata and page SHALL be deduplicated with React `cache()`.

#### Scenario: Interactive control
- **WHEN** a Server Component needs an `onClick`
- **THEN** the control is extracted into a `'use client'` child receiving plain data
