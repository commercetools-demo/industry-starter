# Evidence for workstream A (Bootstrap)

- `command-output.txt`: what `/commercetools:nextjs-setup-project` did (directory renamed to `storefront`, `vercel.json` skipped).
- `versions.txt`: installed versions after the fix-ups (next 16.4.2, next-intl 4.x, platform-sdk 8.x, ts-client 4.x, react 19, tailwindcss 4); proves the version gates.
- `health.json`: blocked: OA-01 (no credentials). Shows the 502 `upstream_unavailable` failure shape seen with placeholder values via `curl /api/health`. The live 200 check is OA-A-c.
- `startup-guard.txt`: `SESSION_SECRET=short` and `EXPECTED_PROJECT_KEY=other-project` stop the server at start, naming the variable or both keys, never the secret value.
- `build-tail.txt`: tail of `npm run verify:build` (build green, bundle scan ok for 3 secret values).
- `fresh-clone.txt`: last lines of `npm ci && npm run check && npm run build` in a fresh clone.
- Browser checks done with Chrome DevTools MCP (no files saved, see M-A-03): `/` redirects 307 to `/en-US`; `/en-CA` has `<html lang="en-CA">`; `/fr-FR/coffee` ends at `/en-US/coffee` (cookie `malva-locale=en-CA` gives `/en-CA/coffee`), 404 page since `coffee` does not exist yet; console shows no errors; no failed requests.
- Screenshots `A-home-375.png`, `A-home-1440.png`: not saved, see M-A-03.
