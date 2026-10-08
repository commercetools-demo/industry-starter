# Workstream D: gaps noticed in the plan or specs

- Spec "Not shipped" (404 in production) and the plan's "check fails if the file exists on a release build" conflict for a tree that is both developed and built; resolved in D-questions.md Q1.
- Spec scenario "Server-only modules guarded at build time" (A's note): `lib/session-core.ts` is deliberately NOT server-only (pure, no secrets) so it can be unit-tested; A's guard test only covers `lib/ct/*` and `lib/session.*`, which is satisfied.
- No logout-everywhere/revocation: a stateless JWT cannot be revoked before 30-day expiry (bootstrap design Q3 stays open).
- `console.error` in `lib/api.ts` logs only error class name and status; this keeps raw SDK messages (which can echo request bodies) out of logs.
- `npm run build` was not part of this workstream's gate; `verify:build` now also runs `check-no-health-in-release.mjs`.
- `npm audit` findings from A remain untriaged.
