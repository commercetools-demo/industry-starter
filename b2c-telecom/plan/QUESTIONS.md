# Questions to the owner

Juniors: add a question when you must stop and ask (see JUNIOR-GUIDE §7). Format:

## Q-001 (workstream X, task X-03)
**Question:** ...
**Blocking:** yes/no
**Answer (owner):** Payment Only is OK (D-061).

## Owner confirmations needed (raised by the planner while writing workstreams)

Answer in this file or in chat; the plan continues with the stated default.

## Q-001 (workstream U, D-061) — Checkout mode
**Question:** Hosted Checkout in **Payment Only** mode (our steps own contact/address/delivery, Checkout owns payment) instead of **Complete** mode as D-041/OA-05 literally say? Complete would ask for contact, address and delivery again after our own steps. OA-05 must create the matching application type.
**Default:** Payment Only unless the L-08 spike shows otherwise. **Blocking:** yes for OA-05 setup.
**Answer (owner):**

## Q-002 (workstream V, D-062) — Phone orders cannot be cancelled online
**Question:** Phone/wireless orders have lead time 0, so "cancel before service start" leaves no window. Accept, or give them a 14-day cancellation window instead?
**Default:** accept (cancel only before service start). **Blocking:** no.
**Answer (owner):** No cancellation window for phone/wireless is fine (D-062).

## Q-003 (workstream M, D-063) — Minimum order and checkout button
**Question:** Minimum order $30 / €28? Show "Check out" to everyone (design shows "Log in to check out")?
**Default:** yes to both. **Blocking:** no.
**Answer (owner):** Fine (D-063).

## Q-004 (workstream G, D-066) — Image licensing
**Question:** The public Pexels search used by the grocery method returned `media.istockphoto.com` URLs there. Are hotlinked stock images from that endpoint acceptable for a demo?
**Default:** yes for demo, credit shown in footer (`/legal/image-credits`). **Blocking:** no.
**Answer (owner):** Check during seeding (D-066).

## Q-005 (workstreams I, N, P, M) — Undrawn UI additions
**Question:** Approve (via SO-01, SO-02, SO-04, SO-07) these additions the prototype does not draw: header search icon, listing sort select, quantity stepper, discount-code field, prompt card, blocked-add notice, dashboard delivery-address card, language switcher placement?
**Default:** build as specified, sign off after screenshots. **Blocking:** no.
**Answer (owner):** Let the juniors use their imagination; sign-offs waived (D-068).

## Q-006 (workstream X) — Release approvers
**Question:** Release approvers: removed entirely (D-069); no longer applicable. **Blocking:** no.
**Answer (owner):** Remove the release approvers entirely (D-069).

## Open, raised by workstream G (2026-10-07)
- **Q-007** Guest checkout vs recurring orders: a recurring line needs a customer on the cart, so D-035 (guest checkout) cannot create a recurring order. Default taken: checkout requires sign-in or auto-registration. Owner to confirm.
- **Q-008** Image licensing: seeded images are iStock files, credit page says Pexels. Default: demo only; credit text to say "stock photography". Owner to confirm.
- **Q-009** Demo customers' password was passed on the command line (`SEED_DEMO_PASSWORD`); decide whether to keep a documented demo password (see G-report).
- **Q-010** Demo order `MLV-DEMO-0003` has a 0 total: confirm intended.
- **Q-011** (from J) `compatible-addons`/`compatible-equipment` are implemented as positive exceptions that skip the family/technology/speed rules (the allow-list reading contradicted the seed: Unlimited Max lists only Netflix). Included equipment satisfies required kinds. Default taken; owner to confirm.
- **Q-012** (from I) Signed-in first name in the header costs one uncached customer GET per page (`lib/ct/account-name.ts`). Default: keep; alternative: R stores `firstName` in the session cookie.
- **Q-013** (from L) G's "first month free" discount stacks on Cable 100 and Air 5G, so the first charge is 0. Intended? Default: keep.
- **Q-014** (from L) `recurringOrderScope` cannot limit a discount to the first order; the stored schedule stays the promise. Default: accept.
- **Blocked (OA-05):** L-09 live Checkout spike (P4/P5) and gate M-L-2 need `CTP_CHECKOUT_APP_KEY`; M and U wait on Gate 2 for live payment only. U must not set `paymentStrategy` itself (order refused without payment allocation).
- **Q-015** (from W) Support mailbox `support@malva.example`, legal text and German copy are placeholders/machine-translated (SO-09). Image-credits page and footer say Pexels but images are iStock with no photographer data (see Q-008).
- **Q-012 resolved by default (R):** kept `lib/ct/account-name.ts` for the header first name; session cookie not extended.
- **Note (R):** test customers `chrome-r-<ts>@example.com` remain in the live project (cleanup selector `@example.com`); `signedInAt` session field is used for session invalidation instead of `iat`.
- **Q-016** (from N) Default listing order is cheapest-first (offers have no order hint, so no "Featured"). Confirm or request an order hint.
- **Q-017** (from N) Existing customers: the existing-customer cable offer is deduped away behind Cable 500 and reachable only via `?offer=`. Should existing customers see the cheaper offer instead? Default: as built.
- **Q-018** (from O) The home page cannot be static/ISR (C-O-5): the layout's `AccountSlot` reads the session cookie so every page is dynamic. Fix would move the account slot to the client. Default: accept dynamic rendering (catalog reads are cached 60 s).
- **Q-019** (from P) The header search magnifier is undrawn: owner sign-off needed (`HEADER_SEARCH_ENABLED` in `lib/config/search.ts` switches it off). German catalog names are English, so `/de-DE/search?q=Tarif` finds nothing.
- **TODO for M (from S):** `PriceSchedule` shows "Dates assume you order today" on order detail pages; needs a prop to suppress. "Buy again" confirms with a toast, not the planned `?reordered` banner on `/bundle`.
- **Note (S):** `scripts/seed/create-qa-order.ts` / `cleanup-qa.ts` create and remove QA customers and orders (cleanup also removes `chrome-r-*` customers).
- **Q-020** (from T) German wording clash: T's pages say "Zahlungsmethoden"/"Gespeicherte Listen", S's navigation says "Zahlungsarten"/"Merklisten". Default: unify on S's navigation wording when the German copy is reviewed (SO-09).
- **Q-021** (from U) Guests with monthly items are sent to sign in at "Continue to payment"; no auto-registration at checkout. Default: as built (confirms Q-007 default).
- **Q-022** (from U) Demo-mode payment (`CHECKOUT_DEMO_PAYMENT=true`, or unset outside production with empty `CTP_CHECKOUT_APP_KEY`) places an order as Paid; in production without a key checkout answers `CHECKOUT_UNAVAILABLE`. Acceptable for the Netlify demo? Default: yes, flagged in the UI as a demo.
- **Q-023** (from U) Service start uses the longest install lead (as M's stamp), not the earliest as the plan text says. Default: longest.
- **Blocked (OA-05):** U-01 gate not ticked; hosted-widget checks C-U-10, 11, 12, 14, 19, 20 and M-U-1..3 wait for the Checkout application + Adyen connector. Unknown until then: `futureOrderNumber` acceptance, completion message codes, whether the connector adds the payment allocation.
- **Q-024** (from V) Order-number validation uses a looser shape than U's `MLV-...` pattern so QA orders (`QA-...`) can be tested. Default: keep loose; confirm.
- **Q-025** (from Y) The Netlify build requires `CTP_CHECKOUT_APP_KEY`; without OA-05 the first deploy fails (`CHECKOUT_DEMO_PAYMENT=true` does not cover the build requirement). Owner: do OA-05 first, or accept relaxing that build requirement for a demo deploy. Also untested: Package directory `b2c-telecom` on real Netlify (pre-approved fallback in the Y workstream file).
