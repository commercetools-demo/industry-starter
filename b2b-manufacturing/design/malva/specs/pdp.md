# Product detail page (PDP) — design spec

PDP = **service detail page**, one per service (12). **Not designed in the prototype** — this spec derives it from the card, page-header, check-list, CTA and aside patterns in `Malva.html`. Mark as *proposed* until reviewed in Claude Design.
Behaviour: `openspec/changes/malva-website/specs/malva-service-detail/spec.md`.

## Layout (proposed)

1. **Page header** — breadcrumb `Home / Plumbing / Drain cleaning & CCTV survey`, H1 = service name, lead = the card description.
2. **Two-column body** (`2fr / 1fr`, gap 48px, same as the quote page)
   - Left: hero photo (service-specific) · "What's included" check list · "Who it's for" (audience tags: `tag` component) · "How it works" (numbered 3–4 steps) · "Compliance and records" (what documents the client receives and where: portal) · FAQ accordion (3–5 items).
   - Right sticky card: **Request a quote for this service** primary button, secondary **Add to quote list** (see `cart.md`), response promise "We reply within one working day", phone `0800 555 0100`, emergency line note for contracted clients.
3. **Related services** — 3 service cards (same component as the PLP), ordered by relation (e.g. Drain cleaning → Backflow & water testing → Pipe repair).
4. **CTA band**.

## Data shown per service

Name, slug, short description (card), long description, included items, audience tags, service frequency options (one-off / scheduled — see `checkout.md`), compliance records produced, related services, images, FAQ. **No price.**

## Interactions

- **Add to quote list** toggles to "Added — View quote list" without leaving the page; selected frequency (if any) is stored with the line.
- **Request a quote for this service** opens the quote form with this service preselected (skips step 1).
- Anchors for in-page sections; no tabs.

## States

Unpublished / unknown slug → 404 page with links to both listings. Loading: skeleton. Service already in the quote list: button shows the added state.

## Responsive

< 900px: single column, the action card moves **above** the long content, and is also repeated as a sticky bottom bar with the primary button.

## Gaps vs. design

Entire page. Content per service (12 × included items, steps, FAQ) must be authored by the owner; photo per service.

## Acceptance

1. Each service has a stable, human-readable URL and unique `<title>` / meta description.
2. Structured data `Service` with `provider` Malva, `areaServed`, `serviceType`.
3. Breadcrumb trail identical to the PLP trail plus the service.
4. The primary action is reachable by keyboard before the long content and is present at every breakpoint.
