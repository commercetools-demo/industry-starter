# Plan listing (phone / wireless / cable)

One template, three category data sets. Source: `isPlans`.

- **Title strip** — `brand-100`, padding 48×0. Breadcrumb "Home / {label}" (Exo 500 14, `brand-800`); H1 (Exo 700 48); blurb (Roboto 18/1.5, `brand-900`, max 640).
- **Filter bar** — chips (see DESIGN) + right-aligned "{n} plans". Filters per category: phone All / Unlimited / Data-capped; wireless All / 5G / LTE; cable All / Up to 500 Mbps / 1 Gbps. Filter matches plan `tag` prefix. Filter resets to All on navigation.
- **Grid** — `auto-fill minmax(300px,1fr)` gap 24.
- **Plan card** — 1px border, radius 24, white. Header (`brand-500`, padding 24): tag (Exo 600 12, min-height 16 so names align), name (Exo 700 26), price (Exo 700 40) + "/mo". Body (padding 24, gap 16): ▸ bullets (pink-700 glyph, Roboto 16/1.4, gap 12); hairline + validity text (muted 14: "Month-to-month", "12-month price lock", "24-month price lock"); CTA pill 2px pink-700 border, Inter 800 15: **Choose plan** (outlined) ⇄ **Selected ✓** (filled). Click toggles; one selected plan per category (selecting a second in the same category replaces it).
- **Add-on upsell** — `pink-50` band, radius 24: "Make it yours with add-ons" / "Spotify, Apple TV+ and more can be added to any plan." + "Browse add-ons".
- Card badges: "Most popular" appears inside the tag text, not as a separate badge.
