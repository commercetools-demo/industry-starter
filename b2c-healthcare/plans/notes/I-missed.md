# Workstream I: gaps and things that may bite others

- The `[...rest]` catch-all makes every unmatched `/<locale>/...` a dynamic route (as is everything under the locale layout already).
- `app/not-found.tsx` (root, outside the locale) is not defined: Next's default 404 only appears for non-page requests that skip the proxy. The proxy redirects all pages to a locale.
- `/<locale>/_boom` and `_tokens` answer 404 in production at the page level; the routes still exist in the route table (`next build` lists them), like `/api/health`.
- The dev env page returns HTTP 200 (a layout cannot set a status); it is development-only.
- A failure in the root layout (for example `getSwrFallback()`) goes to `global-error`, which has English-only copy and no header.
- `lib/log.ts` is only used by `lib/api.ts` so far; `console.error` elsewhere is unchecked.
- The expired-session prompt is a card at the route (route preserved via `?next=`), not a redirect, as the plan says; the spec wording "routed to sign-in" is met by the card's link.
- Browser check was done with curl only (status codes and shell presence on dev and `next start`), not the Chrome DevTools MCP.
