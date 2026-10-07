# Home

Source: `source/Malva Telecom.dc.html` `isHome`. Page order:

1. **Hero** — container 1440 / padding 40; card radius 24, padding 64, `--color-brand-gradient`, 2 cols 1.2fr/1fr gap 40. Eyebrow "New customers" (Exo 600 14px uppercase, 2px tracking); H1 "Fast fiber cable. Zero surprises." (Exo 700 56/1.05); sub "Up to 1 Gbps at home from $39.99/mo, with price locked for 24 months." (Roboto 18/1.5, max 480); CTA "See cable plans" → cable PLP (pink-700 pill, Inter 800 16, padding 16×32). Right: 4:3 image slot, radius 20 — **placeholder** striped box labelled "hero image · family streaming at home"; real photography needed (see PLAN D4).
2. **Promo tiles** — 2-up `auto-fit minmax(320px,1fr)`, radius 24, padding 36. (a) `pink-900`, eyebrow "PHONE PLANS" (`pink-200`), "Unlimited data from $25 a line", CTA "Shop phone plans" (`brand-500` bg / `brand-950` text). (b) `brand-100`, eyebrow "ADD-ONS" (`brand-800`), "Spotify, Apple TV+ and more on your bill", CTA "Browse add-ons" (pink-700).
3. **Shop by category** — H2 36px; grid `auto-fit minmax(260px,1fr)` gap 24. Card: 1px border, radius 24, white, hover `--shadow-md`; honey title band (Exo 700 26); blurb (muted 16/1.5); "From $X/mo →" (Exo 600 14, pink-700). Four cards: Phone plans (From $25/mo), Wireless internet (From $45/mo), Cable internet (From $39.99/mo), Add-ons (Browse all).
4. **Popular add-ons** — band `--color-surface-brand-subtle`, padding 56×0; header row H2 + "View all →"; grid `auto-fit minmax(200px,1fr)` gap 16 of compact add-on tiles (first four add-ons).

Data: "from" prices and add-on prices must derive from the catalog, not literals (the hero "$39.99" and "$25 a line" copy included).
