## 1. Decisions and scaffold

- [ ] 1.1 Confirm MALVA is the intended skin for the grocery starter and assign design for grocery-only UI
- [ ] 1.2 Choose framework (Next.js or Nuxt) and scaffold the project with locale routing
- [ ] 1.3 Decide mobile approach (responsive web vs app design)

## 2. Design system

- [ ] 2.1 Implement tokens from `design/source/_ds/styles.css` as CSS variables or Tailwind theme
- [ ] 2.2 Self-host Caprasimo and Figtree with `font-display: swap`
- [ ] 2.3 Build primitives: Button, Tag, Field/Input, Radio, Segmented, Card, Table, Dialog, Toast
- [ ] 2.4 Build Product tile, Quantity stepper, Heart, Section heading, Blob, washed image wrapper
- [ ] 2.5 Add themed focus, hover, pressed, disabled states and reduced-motion handling

## 3. Chrome and block registry

- [ ] 3.1 Build header, announcement bar, compact nav, footer
- [ ] 3.2 Build block registry with the 43 block types and authored-field validation

## 4. Catalog pages

- [ ] 4.1 Listing page: filter rail, toolbar, grid, applied filters, pagination, empty state, URL state
- [ ] 4.2 Product page: gallery, buy box, options, add to bag, availability, specs, related, reviews
- [ ] 4.3 Resolve made-to-order, finish/size/fitting and reviews from real product data

## 5. Homepage

- [ ] 5.1 Hero variants, category showcase, curated products, editorial panel, concierge strip
- [ ] 5.2 Verify no session data appears in cached shared markup

## 6. Bag and checkout

- [ ] 6.1 Cart page with lines, summary, empty and unavailable states, toast, saved items
- [ ] 6.2 Checkout form, delivery options, payment integration, summary, double-submit protection
- [ ] 6.3 Order confirmation page

## 7. Account

- [ ] 7.1 Dashboard with orders table, address and details cards
- [ ] 7.2 Sub-pages: order detail, address book, payment methods, authentication flows (review with design first)

## 8. Hardening

- [ ] 8.1 Responsive pass at 1440, 1000 and 390px
- [ ] 8.2 Accessibility audit (keyboard, labels, contrast) and Lighthouse
- [ ] 8.3 Visual comparison against `design/source/` prototypes
