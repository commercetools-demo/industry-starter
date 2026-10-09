# Homepage — design spec

Source: `Malva.html`, route `#home`. Behaviour: `openspec/changes/malva-website/specs/malva-homepage/spec.md`. Foundations: `../DESIGN.md`.

## Layout (top to bottom)

1. **Hero** — min-height 620px; full-bleed photo ("technician at industrial plant") under a 40% black overlay. H1 "Plumbing and waste management for sites that can't stop." (56px, max 820px). Lead 20px: "One contract for pipework, drains and waste. Fast response, full compliance records, a single point of contact." Buttons: **Request a quote** (white, → quote), **Explore services** (outline white, → plumbing).
2. **Two services, one accountable partner** — 2-column grid of image cards: *Plumbing* ("Installation, repair, testing and maintenance of water and drainage systems.") and *Waste management* ("Collection, recycling and disposal of general, hazardous and clinical waste."). Each card is one link with "View … services →".
3. **Service you can hold us to** (dark band) — 4 stats: `4 h` emergency response guarantee · `98.6%` visits completed on schedule · `82%` client waste diverted from landfill · `350+` business sites under contract.
4. **Built for your type of site** — 4 audience cards: Facilities managers, Manufacturers, Property & real estate, Healthcare (one sentence each).
5. **Certified and compliant** (wash) — 4 cert chips (ISO 9001, ISO 14001, Licensed waste carrier, Gas Safe & WRAS approved) + 3 testimonials (manufacturer, healthcare group, property owner).
6. **CTA band** (navy) — "Tell us about your site and get a quote within one working day." + white **Request a quote**.

## Interactions

- Both service cards and both hero buttons are plain links; no carousels, no autoplay.
- Top bar and nav present on every page; the nav item for the current section is underlined.

## States

Static content page — no loading or error state of its own. Stats, certificates and testimonials come from managed content; if a block has no entries it is omitted, not rendered empty.

## Responsive

< 1180px logo subline hidden · < 900px all grids collapse to one column, hero H1 38px, side padding 20px. **Proposed:** a menu button replaces the hidden nav links (design gap 3).

## Sample marker (owner decision, 2026-10-08)

Stats, cert chips and testimonials that are not yet confirmed render with a small "Sample content" tag (12px, `tag` component, top-right of the band or card). A launch check fails while any sample-flagged item is published.

## Gaps vs. design

- Audience cards are not links; propose linking each to the quote form with the sector preselected (`?sector=`), see `checkout.md`.
- Stats and testimonials are sample data (DESIGN.md gap 7).
- No services quick-list on the homepage; the 12 services are one click away.

## Acceptance

1. One `<h1>`; sections use `<h2>`.
2. Hero text passes 4.5:1 against the overlaid photo at all breakpoints.
3. Both primary CTAs reach the quote form in one click.
4. Photo uses responsive sizes and is the LCP element (priority-loaded); no layout shift.
