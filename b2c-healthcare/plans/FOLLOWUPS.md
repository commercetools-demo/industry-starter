# Follow-up workstreams (after the 2026-10-09 owner answers)

These extend the A–Z plan. They are tracked here (not in `verify-plan.mjs`, which covers A–Z); acceptance = `npm run check`, `npm run build`, `npm run e2e` green and the notes files.

| ID | Scope | Decisions | Depends on | Status |
| --- | --- | --- | --- | --- |
| AA | Rework checkout/orders around the **full commercetools Checkout** (Checkout creates the order; idempotent post-order finalization; payment lifecycle via Checkout) | D-034, D-035 | Q, S, T, U | In progress |
| AB | **Medicine PDP** `/medicine/<key>` and links from search/lists/home | D-037 | K, N, O, W | In progress |
| AC | Seed + images + scopes: `clinicName` searchable, `seed:full` full cleanup, scope list per D-036, Pexels-only images generated and committed (clean URLs), all image slots used | D-036, D-038, D-039, D-040 | E, F, M, V | In progress |

Notes per follow-up: `plans/notes/AA-*.md`, `AB-*.md`, `AC-*.md` (questions, todos, missed).
