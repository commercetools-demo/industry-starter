# Workstream M: live checks (need credentials, a seeded project, or Lighthouse)

Browser checks so far were done with fixtures: `MALVA_FIXTURES=1 PORT=3110 npm run dev` (dummy CTP_* values suffice), by HTML assertions with curl (Chrome DevTools MCP was not connected): 7 "available today" in the chip, 3 doctor cards linking to `/en-US/doctor/mlv-doc-...?m=remote`, no "2M+", no "Rx #", no pharmacist line, no same-day or auto-refill line in the markup, canonical and hreflang absolute, image areas are placeholders.

1. Seeded project: `/en-US` shows up to 3 doctors whose badge says "Available today" and the same count as the hero chip and the band; compare with `/en-US/doctors/remote?today=1`.
2. Run `npm run seed:images` and confirm the hero, rx and journal images load with clean URLs (no `?` in the Network tab).
3. Shipping read: with the seeded `mlv-same-day` method, the prescription block shows "Same-day delivery in selected states"; with it deactivated the line disappears (60 s cache). Needs `view_shipping_methods`.
4. Set `AUTO_REFILL_ENABLED=true` only after workstream T ships; the line "Auto-refills you can pause anytime" must then appear.
5. Browser at 1440 and 390 px against `design/source/Malva Healthcare.html`: hero image 460 px (300 px under 900 px), the chip over the image, the services grid, the band, the footer emergency line. The header search link is hidden under 900 px.
6. Lighthouse (mobile): performance >= 80, accessibility >= 95, SEO >= 90. Check the contrast of `text-neutral-600` meta text on the surface-subtle sections and `text-navy-100` on navy-700.
7. Sam signed in (seed account): reload with throttled CPU; the home header shows the Cart count and the initials without showing "Sign in" first (the layout seeds the SWR fallback from the session).
8. Throttle or break the commercetools connection: the home page must still render the static sections (live sections left out).
