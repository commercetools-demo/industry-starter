# My account

Source: `isAccount` (requires a signed-in user; anonymous → login). Title strip "Home / My account", H1 "Hi, {firstName}".

- **Summary row** (`auto-fit minmax(300px,1fr)`, gap 24): (1) ACCOUNT — email, "Account no. MV-48210-7 · Active"; (2) MONTHLY BILL — total (Exo 700 36), "Next bill Oct 28, 2026"; (3) honey card "Want to change something?" with "Browse plans" (brand-950 pill) and "Log out" link.
- **Current contract** — H2 + table (bordered, radius 24, horizontal scroll, min-width 640): header row on `neutral-50` (Exo 600 12 caps: ITEM, TYPE, STARTED, TERM, PRICE right-aligned), grid `2fr 1.2fr 1.4fr 1.4fr 1fr`. Rows: Cable 500 · Cable internet · Mar 12, 2026 · 24 months · ends Mar 12, 2028 · $59.99; Unlimited · Phone plan · Jun 3, 2025 · Month-to-month · $50.00; Spotify · Add-on · Jun 3, 2025 · Month-to-month · $10.00. Footnote: early-termination fee is shown on the plan's Broadband Facts label.
- **Your plans** — H2 + grid `auto-fit minmax(min(100%,400px),1fr)` of Broadband Facts labels, one per active plan (add-ons have no label).
- Not designed: order history, address book, payment methods, edit profile.
