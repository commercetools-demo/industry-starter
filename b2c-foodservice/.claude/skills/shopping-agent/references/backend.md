# The backend: the one integration surface

`StorefrontBackend` (upstream `shopping-agent/core/shopping_agent/backend.py`)
is the only interface an adopter implements. Read `docs/backends.md` alongside
this — it is organised as six decisions, and they are the right six.

Everything a method returns reaches the model as **fenced data**. Every method
acts for the customer in the session context, calling the store's own APIs
server-side with a credential the host resolves from the session. The model sees
a method's result, never a token.

**No method places an order or moves money.** There is no such method, and the
absence is the enforcement.

## The methods, and what each one really promises

Fourteen upstream, four of them optional with sensible defaults. Add one more if
your cards render money (see **Money**, below).

### Catalogue

**`searchProducts(session, query, filters, limit)` → `Product[]`**
Closest text matches, best first, at most `limit` (already clamped to the
config's ceiling by the executor). A **family is one result** — its variants are
not results of their own. An **empty list means nothing matched**; that is why a
disabled or unreachable index must throw a distinct error rather than return
none.

Build a **dedicated query for the agent**. Do not reuse the site's product-grid
search:

- **Drop any fuzzy `description` clause.** It is tolerable in a
  human-scanned grid and unacceptable here, because results enter
  **provenance** — the gate that authorises cart writes — so noisy recall
  becomes an authorised bad add.
- **Match in the shopper's language *and* the fallback language**, every clause,
  the fallback at reduced boost. A text clause scoped to one language on a
  multilingual catalogue can match *nothing*, and the agent then tells the
  shopper the store sells no sofas.
- **Send no sort on a text query.** An explicit sort destroys relevance
  ranking.
- Route `filters.attributes` through the same machinery the site's facets use,
  so anything faceted is agent-filterable for free.
- **Drop an unknown filter key or an unresolvable category, and say so in a
  note appended to the tool result.** Never pass it through: an unknown category
  id returns zero rows, and the agent then reports "nothing matches" for a
  catalogue that has the product. A dropped price ceiling that goes unmentioned
  produces an over-budget shortlist presented as if it met the constraint.

Upstream's `searchProducts` returns a bare list with no channel for "this filter
could not be applied". Adding one is a worthwhile divergence — have the backend
accumulate notes and let the executor drain them, feature-detected so a backend
without notes still works.

**`getProductDetails(session, productId)` → `ProductDetails | null`**
The full record for one id **as the model wrote it**, or null when unknown. A
family's `variants` array carries its purchasable records inside one fenced
result, and **the record *and* its variants enter provenance** — without that, a
shopper choosing a size is refused. This is also the one catalogue read that
must keep working when the search index is down, so an id already in provenance
stays usable.

### Cart

**`getCart(session)` → `Cart`** — the session's cart, empty when nothing is in
it. Read before every turn, by the gates, and by the checkout component.

**`addToCart(session, productId, quantity)` → `Cart`** — **a delta.** The
quantity has already been reduced by the gates so the line stays within the
per-item cap.

**`updateCartItem(session, productId, quantity)` → `Cart`** — **a set.** A
product the cart does not hold leaves the cart as it is; that is not an error.

**`removeFromCart(session, productId)` → `Cart`** — same tolerance.

The cart methods are the only writes. Each arrives *after* the executor's
provenance gate and quantity caps, and the backend **still enforces its own
business rules atomically** — eligibility, stock, limits. The executor's lock
covers one process, and a horizontally-scaled host will have two invocations for
one session routinely, so wrap platform writes in the platform's own
optimistic-concurrency retry.

Out-of-stock raises the "unavailable" signal with **ids only**: what is
unavailable and, for a variant, which siblings are in stock. Titles are
catalogue text and stay inside fences.

### Customer context

**`getPreferences(session)` → `UserPreferences`** — the profile, a guest profile
included. Read before every turn; no tool writes to it. Do not invent a loyalty
tier the store does not model — absent is the honest value.

**`getAccountContext(session)`** *(optional, default none)* — account facts for
the per-request context block. Sent on **every** request, so keep it small; the
runtime replaces an over-large payload with a note.

**`checkoutHandoff(session, cart)`** *(optional, default none)* — where this
cart is paid for **when that is not a route in the host app**: a platform's
hosted checkout URL, or one URL per seller on a marketplace. The executor
attaches the result to the checkout component *after* the model's call, so the
URL is never a tool argument and never reaches the model. Returning none is
correct for a storefront that owns its own checkout route — the card links
there.

### Orders

**`getOrders(session, limit)` → `Order[]`** — the customer's **own** orders,
newest first. Their items enter provenance, so a reorder needs no search.

**`getOrder(session, orderId)` → `Order | null`** — null when the id is unknown
**or belongs to someone else**.

**Ownership is the security-relevant line in this whole file.** An id having
provenance does not make it the caller's. Query so a mismatch is a *zero-row
result* — scope the lookup by customer in the query itself — and use the
platform's parameter binding, never string interpolation: `orderId` arrives from
the model.

Accept the **order number** as well as the internal id. A shopper has the number,
not a UUID.

Map platform states to the agent's status enum in **precedence order** (refund →
return → cancelled → delayed → shipped → complete → processing), and be careful
with the "confirmed but not yet shipped" state — it is *processing*, not
*shipped*. Read the order total with the same helper the account pages use, so a
card and an order page cannot print two totals for one order.

Delivery estimates and tracking URLs are **absent unless the platform really has
them**. A tracking id and a carrier are not a URL; deriving a date from a
shipping method's name is inventing one.

### Policies and fulfillment

**`searchPolicies(session, query)` → `Policy[]`** — help and terms passages
matching the query, empty when none do. If there is no corpus, switch policies
**off** in config rather than returning nothing: the policy grounding gate would
otherwise force every terms question through a tool that can never answer.

**`getFulfillmentOptions(session, productIds)` → `FulfillmentOption[]`** — for up
to twenty ids as the model wrote them; unknown ids are skipped. The `eta` field
is **required by the contract**, which is exactly why enabling this is a
decision rather than a default: if the platform's shipping methods carry no
delivery-estimate field, the honest sources are a method's own localized
description or nothing. **Never invent "3–5 business days."** If no method
carries a usable description, switch fulfillment off.

Free-shipping thresholds: compute the qualifying basis with the shipping cost
**subtracted**, or you inflate the basis by the very cost being decided.

**`getDisclosure(session, productId)`** *(optional, default none)* — the facts
box the disclosure component renders, **authored here in full**. Off unless
there is a real source.

## The id scheme

This is the decision most likely to be wrong, and the hardest to change later.

Most commerce platforms have **no single string meaning "a purchasable thing"**:

- a product id identifies a *family*, which is not itself buyable when it has
  several variants;
- a variant id is often unique only *within* its product;
- a SKU is the natural handle but is frequently **nullable**.

The agent's contract is that ids are opaque strings passed through unchanged,
and that a family id and a variant id **share one namespace** — `docs/backends.md`
is explicit: if a parent's platform id can equal a child's, prefix the family id
in your backend.

A scheme that works:

| Shape | Means | Linkable to a product page? |
|---|---|---|
| `<prefix>:<product-id>` | a **family** — options still to choose | No. It has no SKU of its own, so send no slug either |
| `<sku>` | a plain product, or a variant addressed by SKU | Yes |
| `<product-id>#<variant-id>` | a variant the platform holds no SKU for | No |

Prefer SKU for the variant case: it is short, model-transcribable, and already
the store's own handle. A 36-character UUID in every variant row also eats the
character budget a compact row is assumed to fit in.

Require the *platform id* shape inside both special forms, which is what keeps
them unambiguous against arbitrary SKUs — a SKU containing `#` then decodes as a
SKU. The residual ambiguity (a SKU that is literally the special form) is not
worth defending against; a comment is cheaper than a scheme that is.

Put encode and decode in **one module**, and make decoding never throw: an
unrecognised string is a SKU, and resolving it is the catalogue's job — an
unknown id yields null there, which is the documented contract.

### Family or plain: the classification rule

**One variant OR zero selectable options ⇒ plain**, served under the master
variant's handle. The zero-options branch is load-bearing: a product whose
variants differ only in attributes the product page hides shows no selector
there, and the agent must agree. Derive options from the *same* shared module
the product page's selector uses — the agent is one more surface, not a new
convention.

A family's price is its lowest **in-stock** variant's, presented as a "from"
price. A family is in stock while any variant is.

**The cart refuses a family id.** That refusal is the options hold, and it lives
in the backend and the gates — not in the UI. A card's Add button branching on
"has options" and handing the choice to the assistant is an *affordance*; the
refusal is the *control*.

## Money

Two conventions meet here, and both are `number`:

- the platform's — an integer of **minor units** plus a fraction-digits count;
- the agent's — a **float in major units**.

Do the conversion in exactly one inbound module. **Honour the platform's own
fraction digits** rather than dividing by 100: every currency you serve today
may well use 2, and hard-coding it is wrong the first time a zero-decimal
(JPY, KRW) or three-decimal (BHD, KWD) currency is added — in a way that reads
as a pricing bug rather than a units bug.

For a cart or order line, the agent's unit price is **`lineTotal / quantity`**,
computed in minor units and then scaled. Deriving it the other way rounds the
line total to major units before splitting it, which drifts on a line whose
per-unit share is not a whole minor unit. A zero quantity yields 0, not a NaN
that would travel silently into a fenced payload.

**Add a cent-exact totals method** for the checkout card. The model-facing cart
total is the sum of line totals; if the platform does not distribute whole-cart
discounts across lines, that figure exceeds what the shopper owes. Build the
card's numbers straight from the platform cart with the same helper the cart page
uses. Useful fields: list total before discounts, total savings (never
negative), the payable items subtotal, and — set **only when a threshold exists
and the cart is short of it** — how much more to spend for free shipping, so the
card can render the nudge by presence alone.

## Return nothing rather than something wrong

`docs/backends.md` Step 6 is the whole discipline, and it is worth restating as
a rule you enforce in review: **a figure the platform cannot supply is absent.**
Rating, review count, delivery estimate, tracking URL, loyalty tier, ETA. A
`0.0` rating renders as one star. An "estimated total" equal to the subtotal is
a number the shopper will discover is wrong at checkout. A row whose value is
"we'll tell you later" carries no information — remove the row.

## Session state

Provenance is not a cookie and not a module-level map.

The provenance record is the newest N product records — capped, insertion-ordered
so eviction order is *arrival* order. Enrichment needs the **whole record** (it
joins image, rating, price onto every card) and the options gate needs the
options, so an id-only store breaks enrichment outright. At upstream's cap of 200
records this is well over 100 KB read and rewritten every turn; a much smaller
cap is the right call for a serverless host, and the model is already told what
to do about a dropped id by the provenance error message.

A module-level map is not a store either: a horizontally-scaled host would split
one session's provenance across processes, which the safety table forbids —
"the state must be loadable by a request on another process."

See `runtime.md` for the storage contract and its compare-and-set semantics.
