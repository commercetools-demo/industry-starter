# Cart (quote list) — design spec

There is no price and no purchase: the "cart" is a **quote list** — the services a prospect or client has asked to be quoted. **Not designed in the prototype**; derived from the quote form, option cards and table styles. Mark as *proposed*.
Behaviour: `openspec/changes/malva-website/specs/malva-quote-list/spec.md`.

## Layout (proposed)

- **Entry points**: "Add to quote list" on the PDP; nav gains a **Quote list (n)** link next to *Request a quote* only when the list is non-empty; a right-hand drawer (overlay shadow, 420px) opens on add.
- **Page** `Quote list` (page header + `2fr / 1fr`):
  - Left: table, one row per service: name (link) · category tag · frequency select (*One-off · Weekly · Fortnightly · Monthly · Quarterly · Annual*, only options valid for the service) · site count/notes field (optional) · remove (text button).
  - Right card: "Services: n", "Sites: from the next step", primary **Continue to request** (→ checkout step Site, step Service already satisfied), secondary **Add another service** (→ plumbing), helper "No payment is taken. We reply within one working day with a priced quote."
- **Empty**: "Your quote list is empty. Choose the services you want quoted." + **Browse plumbing** / **Browse waste management**. (Plain instruction + CTA, per the system's empty-state rule.)

## Interactions

- Add, remove, change frequency update in place, persisted across reloads and across sign-in (guest list merges into the account's list).
- Adding a service already in the list is a no-op with the message "Already in your quote list."
- Quantity steppers are **not** used (services have no quantity); site count is captured in checkout.

## States

Loading: skeleton rows · Error: inline retry · Service unpublished since it was added: row flagged "No longer available", excluded from submission, removable.

## Gaps vs. design

Everything. Open decision: whether guests can keep a list (recommended: yes, anonymous cart) — see `PLAN.md` D3.

## Acceptance

1. The list never shows a price, tax or total.
2. All controls are labelled; frequency select has an associated visible label per row (visually hidden on desktop is acceptable).
3. List survives reload; badge count in nav matches rows.
4. List contents carry into the quote form without re-entry.
