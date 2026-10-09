# Workstream A: left undone, live checks, owner actions

- Clean-clone dry run (A-09) was done locally in the scratchpad: `git clone` of the branch, `cp .env.example .env.local`, `npm ci`, `npm run check` (5 files, 50 tests pass), `npm run build` (ok, routes `/` and `/_not-found`), `node scripts/check-bundle.mjs` (ok). The "paste in the PR description" step is left to whoever opens the PR; no PR was created.
- Dev server check: `PORT=3101 npm run dev`, `/` returned 200 with "Malva Healthcare" and no `CTP_CLIENT_SECRET` in the page source. Server stopped.
- TODO (live credentials, not possible here): none for A. The CT health check is H-10/D territory.
- Owner action: confirm `CTP_SCOPES` list in `.env.example` against the real API client (OA for the API client).
- `scripts/check-tracked-files.mjs` and `scripts/check-bundle.mjs` were added beyond the literal task list; `check-tracked-files` is part of `npm run check`, `check-bundle` is part of `npm run verify:build`.
- Not done by design: `.oxlintrc.json` design rules and token parity (workstream B), locale routing, messages, `proxy.ts` (C), `app/[locale]` files (H-10).
- Not touched per instructions: `plans/STATUS.md` (counts for A: all 9 tasks done, 50 tests; set `Ready for review` there).
