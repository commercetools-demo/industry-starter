## Context

Source design: Claude Design project "MALVA Luxury Decor App". Imported files are persisted under `design/source/` (`MALVA Web.dc.html`, the 1440px prototype; `Canvas.dc.html`, the 43-block page-builder library; excerpt of the "Organic" `styles.css`). Fuller reference: `design/DESIGN.md`, `design/specs/*.md`, `design/PLAN.md`.

The prototype is desktop only, uses hard-coded data (12 products, one fake customer) and draws a single-page checkout and an account dashboard only. It is authoritative for layout, tokens, components and states, not for data or business rules.

## Goals / Non-Goals

**Goals:**
- Make the design implementable and testable as requirements.
- Keep one token source so pages never hard-code color, font, spacing or radius.
- Preserve the page-builder block model (content, listing, pdp, chrome groups) so merchandisers can compose pages.

**Non-Goals:**
- Choosing the frontend framework or data layer.
- Mobile-app screens (`MALVA App.dc.html`) and the freshness variant.
- Changing behavioral specs in `openspec/specs/`.

## Decisions

- **Visual specs are separate capabilities, not deltas.** Existing specs describe behavior (caching, session context, totals); design specs describe layout and states. Keeping them apart avoids editing 20+ behavioral specs. Alternative: MODIFIED deltas on each page spec, rejected as noisy and lossy.
- **Tokens are the contract.** The Organic CSS variables are normative; px/hex literals that a token carries are non-conformant.
- **Responsive rules are proposed.** Desktop ≥1200 is as drawn; 768–1199 and <768 collapse rules are authored here because the design omits them. They need design sign-off.
- **Prototype business rules do not ship.** Free delivery over €800, "made to order" derived from price/category, €45/€12 delivery prices and all demo copy are placeholders.
- **Session-specific UI is never cached.** Bag count, saved-heart state and account name follow `home-landing-page`.

## Risks / Trade-offs

- [Brand mismatch: luxury decor design vs grocery starter] → Confirm intended skin; grocery-only UI needs its own design.
- [Account sub-pages and checkout states are undrawn] → Specs mark them as proposals derived from existing components; review with design.
- [Prototype assets/copy are placeholders] → Source real imagery and copy before launch.
- [Fonts load from Google CDN] → Self-host Caprasimo and Figtree.

## Open Questions

- Is MALVA the intended skin for the grocery starter? Who designs delivery-slot picker, weight pricing, substitutions, recently ordered, quick order?
- Next.js or Nuxt?
- Is responsive web sufficient on mobile, or does the app design govern small screens?
- What product attributes back finish/size/fitting options, "made to order" and reviews?
