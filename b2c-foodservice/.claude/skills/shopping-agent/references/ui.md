# The UI

Upstream's client is already TypeScript and React, so this half is
copy-and-adapt rather than a port. `examples/web-shared/` is the shared client;
`examples/retail/storefront-web/` is a worked storefront with the card
components.

## Copy nearly verbatim

- **`protocol.ts`** — the client mirror of the server's event union, plus the
  transcript item types. It and the server module must stay in step; treat a
  change to either as a change to both.
- **`turn.ts`** — the turn state machine, and the piece most worth *not*
  rewriting. Getting its slot keying, adoption, pacing or retry hold subtly
  wrong shows up as a card that flickers or loses its place, which is exactly
  what the design exists to prevent. See below.
- **`scroll.ts`** — stick-to-bottom that does not fight a shopper who has
  scrolled up to re-read a card.
- **`api.ts`**'s event-stream reader — verbatim.
- **`Markdown.tsx`** — and this is a **security** choice, not convenience. It
  renders React text nodes only, so model- and catalogue-derived text stays
  inert. Do not swap in a general markdown library that can emit HTML.
- **`QuotedAsData.tsx`**, `MessageBubble.tsx`, `Suggestions.tsx`,
  `Transcript.tsx`, `Composer.tsx`.

## Adapt

**`api.ts`'s session handling.** Upstream keeps the session id in a client field
and sends it as a header — right for its own demo API, a downgrade in a
storefront that already has a signed, httpOnly session cookie. Put the agent
session id **inside that cookie**: the browser then cannot read it, cannot swap
it for someone else's, and every request is authenticated by the cookie it
already sends. Return the id from session-start **only** so the UI can tell
"ready" from "not ready".

That is also why **the transcript is never posted from the client** — see the
invariant in SKILL.md. A turn is one `{ message }`.

Have every read return `null` on any failure, so a caller keeps its last good
state rather than blanking.

**`format.ts` — do not copy `formatMoney` at all.** Not adapted, not
re-exported, so it cannot be reached by accident. It hard-codes `en-US`, and
several of its callers in the reference cards pass **no currency argument**,
which shows a non-USD shopper the wrong symbol. Replace it with one module
exposing two hooks:

- one that takes a **major-units** amount off an agent payload and converts to
  minor units before formatting;
- one that takes a **minor-units** amount the server already sent cent-exact and
  formats it directly.

Both must read the currency from the app's own locale context and be impossible
to call without one. Routing a cent-exact field through the major-units hook
multiplies it a second time.

## Do not bring

- **`ui.tsx`** — a second design system duplicating the host app's. Several
  hundred lines of components you already have.
- **`icons.tsx`** — take the two or three icons you need inline.
- **`catalog.ts`, `portal/`, `storefront/`** — demo-app specifics.
- **`Inspector.tsx`** is genuinely useful as a dev trace panel; treat it as a
  follow-up, gated to non-production.

## The turn state machine

What it does, so you can tell a bug from the design:

- **Slots are keyed by turn + component + ordinal, not by tool-call id.** That
  is what lets a retry re-use the card's DOM node instead of unmounting and
  remounting it.
- **Partial frames are queued and released on a timer** (a slower pace for
  structural growth, faster once the final payload is waiting behind the queue),
  and above a queue depth every second frame is dropped. Without pacing, a burst
  of frames arriving at once renders as a flash rather than a card assembling.
- **A card whose payload failed validation dims and holds its last frame**
  (`retrying`) rather than disappearing, because the model is about to send a
  corrected call.
- **A partial card's arrays are a prefix of what is coming**, so components must
  render a trailing skeleton rather than settling their layout.
- The suggestions component is **consumed by the transcript**, not dispatched to
  the card registry.

Two adaptations worth making:

- **Inject the activity-line copy** rather than importing it, so its ~30 strings
  can be translated. A hook cannot call the app's translation hook on its
  caller's behalf.
- Put the post-turn extraction request in the **provider**, fired on turn end,
  rather than inside the machine.

## The panel

**Not a modal drawer.** The whole point is that the shopper can keep reading the
page beside the conversation — a backdrop says "finish with me first", a dock
says "I'm here as well". So: no `aria-modal`, no focus trap, no scroll lock, and
the page stays interactive. Below the breakpoint where there is no room for two
things at once it becomes a full-screen sheet, where a scroll lock *is* correct
because nothing of the page is visible to scroll.

**Start the session on first open, not on mount.** Starting it on mount creates
a durable session record per page view for visitors who never open the panel.

**That change exposes a second bug: input typed before the session is ready.**
Queue it in the provider and flush on ready, rather than disabling the composer
— a disabled composer during a one-second handshake reads as a broken widget.

**Track "panel opened" on the *edge*, and detect the edge outside the state
updater.** Two ways to get this wrong, both common: tracking inside an `open()`
function while the launcher calls `toggle()` gives you conversations nobody
appears to have started; tracking *inside* a `setState` updater double-counts,
because React may invoke an updater twice under StrictMode. Keep a ref of the
open state, test it before setting, and route both `open()` and `toggle()`
through that one path.

## The cards

Eight components exist in the registry. The suggestions one is consumed by the
transcript and the disclosure one only exists if you enable disclosures, so
there are **six cards to build**: products, comparison, plan, guide, order
status, checkout.

Verdicts worth inheriting, each of which is a deletion:

| Card | What to change |
|---|---|
| **Product carousel** | Keep the carousel/grid/list switch, the overflow masks, the expanding detail panel, and the **variant list** — that last is what makes a *family* record safe in a carousel, because picking a variant asks the assistant rather than adding an unbuyable id. **Delete the price-history sparkline and the per-aspect review sentiment bars**: in the reference both render *invented* data (a sine wave seeded from a hash of the product id, and sentiment synthesised at demo boot). Fabricating them on a page a customer reads is the stand-in-zero failure. |
| **Comparison grid** | Keep the subgrid pro/con baseline alignment. Fix the currency-less money calls. |
| **Guide** | Near-verbatim. With policies off, its sources come from product records and model knowledge rather than the store's own guide. |
| **Plan checklist** | Keep the budget bar — it sums the *cheapest* option per step **and says so**. Fix its money calls; re-map its arbitrary palette onto the host app's. |
| **Order status** | Keep the delivery rail. **Delete the ISO-date parsing** that pulls two dates out of one string: it is a private convention with the reference's fixtures, and if your orders carry no estimate, leaving it in implies a convention you do not honour. Keep the `^https?://` check on a tracking URL as defence in depth. |
| **Checkout summary** | **Rewrite.** The reference prints "Shipping: calculated at checkout", "Tax: calculated at checkout", and an estimated total equal to the subtotal. A row whose value is "we'll tell you later" carries no information, and an estimated total the shopper will find wrong at checkout is worse than no total. Render: lines → a discount row **only** when savings are non-zero → the payable subtotal → a free-shipping nudge only when one applies → a real link to checkout. Keep the "not charged" pill and the `aria-describedby` wiring. Keep the handoff rendering even if your backend returns none, so a fork can set one. |

**Share the pieces of your product tile, not the tile itself.** Neither the
site's listing card (platform-shaped props, whole-tile link, wide grid) nor a
previous chat widget's tile fits a ~190px horizontal scroller that expands a
detail panel and routes a family's add to the assistant. Share the star rating,
the image-URL transform, and an image placeholder. From the reference's tile,
keep the unbreakable-trailing-parenthetical title trick, the option line, and
the Add button's phases **including its "has options ⇒ ask the assistant"
branch**.

Drop the reference tile's delivery-promise, low-stock and returns chips: they
read attributes the demo backend stamps on every product, which a real catalogue
has no equivalent for. The returns chip additionally prints a store-policy
constant, which with policies off is a claim you cannot source.

**Review the cards at panel width.** The reference drew them for a ~760px
measure; a dock is 480–560px. Use a **container** query for any two-up layout —
a viewport breakpoint measures the window, so on any desktop it will put two
210px columns inside a 480px dock. Budget a narrow-width pass; this is the most
likely source of visual rework.

## The token layer

The reference cards are written against CSS custom properties (`--ink`,
`--card`, `--accent`, `--shadow-*`, …) and a handful of bare class hooks. A host
app with its own named-colour theme resolves none of them.

Rather than hand-rewriting every class, define **one scoped layer**: a single
class on the panel root and the showcase page that maps those properties onto
the host palette, plus rules for the bare class hooks the copied components
reference by name. The arithmetic is the argument — the cards and tile reference
those properties a couple of hundred times, and rewriting each is that many
chances to get a colour subtly wrong *and* makes every future upstream diff
unreadable.

Have the mappings read the host theme's own variables wherever one exists, so
the theme stays the source of truth. Restyling is then one file, and the
vocabulary cannot leak because nothing outside the scope resolves it.

Three cascade traps, all of which have shipped:

1. **Import the token file into the framework's *base* layer, not unlayered.**
   Utility-first CSS frameworks put every utility in a utilities layer, and
   **unlayered CSS outranks any layer** — so an unlayered `color` declaration on
   the scope class beats every text-colour utility on the *same* element. The
   launcher button is exactly that element: it carries the scope class and a
   text-colour utility together, and the symptom is a solid pill with an
   invisible label and icon, with no error anywhere. A token layer must never
   outrank a utility.
2. **Scope class hooks so they match the root as well as its descendants.** A
   descendant combinator does not match an element against *itself*, and the
   panel root carries both the scope class and its own animation hook — so the
   dock's entrance animation silently never plays. `:is(.scope, .scope *).hook`
   has the same specificity as the descendant form and matches both.
3. **Renaming an upstream class hook means writing its rule too.** Namespacing
   the reference's generic hook names so they cannot collide with host classes is
   right; forgetting to carry the rules across is invisible in review *and* at
   runtime — a sent message renders as unstyled text and the suggestion chips as
   bare button labels. Grep the components for every bare, non-utility class name
   and check each one has a rule.

If the framework generates utilities by scanning source files, make sure the new
component directory is in scope, or none of the classes are generated at all.

## Internationalisation

Two hazards, and the second is the expensive one.

**Every string in the cards and the activity copy** — roughly ninety of them —
belongs in the app's message catalogue, in its own namespace. Reuse the app's
existing order-state wording so a card and the account pages say the same word
for the same order. `"From $349"` must be a real ICU message, not concatenation:
German puts the preposition differently, Spanish differently again.

**Write a test that scrapes every translation key literal out of the agent's
component and client directories and asserts all locales define it.** This
matters because a missing key typically renders as *its own dotted path*: the
failure mode is the literal text `agent.priceFrom` appearing on a product card
in production, which no type check and no build catches. Cover computed key sets
(status, rail, tool-name namespaces) explicitly, since a scraper cannot see
them.

Run a locale-review pass over the finished set.

## Cart-add instrumentation: exactly one call site

Pull the add handler **from the provider inside the card registry**, rather than
threading it down as a prop from the panel. That single decision makes the
registry the one junction every add affordance on every card passes through — the
carousel tile, a comparison entry, a plan step's product, the grid and list
layouts — so there is exactly one analytics call and one cart revalidation, and
a seventh card gets both for free. A card taking its own handler prop could
quietly skip them.

Three details:

- Fire the event **only after the server confirms** the add, never
  optimistically.
- Pass sku, name, price and currency whenever the component has them. Ids alone
  render a "products purchased" report as a list of UUIDs with nothing to total.
- **Revalidate** the app's cart cache rather than writing the agent's payload
  into it, so the cart keeps one authority. And do not use whatever helper pops
  the mini-cart — it would cover the panel the shopper is reading.

If you are replacing an existing chat surface, its analytics surface name
disappears with it. That is a deliberate series break in the reports; tell
whoever owns them rather than letting them find a cliff.

## The showcase page

Build a fixture-driven page rendering **every card × every slot state × every
locale**, and build it **alongside the first card**, not after.

It is the only practical way to do the narrow-width review and the i18n pass,
and the only deterministic target for tests — otherwise every card is
unreachable without paying for a model turn *and* hoping the model picks that
card. Route it under the app's locale segment so it carries real translations,
apply the token layer, and gate it off production.

One gotcha if you gate it: gate on a value that exists **in the request
runtime**. A build-only environment variable read at request time is simply
absent, so the page 404s on every deploy including the previews you wanted it
for. If the framework inlines a public prefix at build time, re-export the
build-time value under such a name and read that.
