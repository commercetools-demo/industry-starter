---
name: shopping-agent
description: Implement Anthropic's reference commerce shopping agent (github.com/anthropics/commerce-agents) inside a storefront web app — the StorefrontBackend integration surface, the trust-safety gates (fencing, cart provenance, server-side presentation enrichment, grounding), the streaming turn loop and prompt-cache layout, the generative product/comparison/plan/guide/order/checkout cards, and the serverless deployment constraints. Use this skill whenever someone wants to add a shopping assistant, conversational commerce, an AI chat that can search a catalogue or write to a cart, generative UI cards in a chat panel, or wants to port, upgrade, or debug an existing commerce agent — including when they only say "AI shopping assistant", "chat that adds to cart", "commerce-agents", or name one of its pieces (search_products, present_comparison, checkout card, provenance gate, StorefrontBackend).
---

# Shopping Agent

Build a shopping assistant into a storefront by porting Anthropic's reference
commerce agent and implementing its one integration interface over the store's
own systems.

**Upstream is the specification.** <https://github.com/anthropics/commerce-agents>
(Apache-2.0). Clone it and read from it as you go — this skill tells you what
each piece is *for*, what it costs to get wrong, and what must change when the
target is a different language or a serverless host. It does not restate the
code, because the code is upstream and will move.

The reference is Python. Its own scaffolding plugin sanctions a port
(`plugins/commerce-builder`, "Other languages: port module by module and keep
the names"), and its frontend is already TypeScript/React, so a TypeScript
target is copy-and-adapt for the client half and a module-by-module port for the
agent core.

---

## What you are actually building

Three layers, and only the middle one is yours to invent:

| Layer | Origin | Effort |
|---|---|---|
| **Agent core** — fencing, gates, prompt, tools, turn loop, presentation, memory | ported from upstream, names kept | mechanical apart from a dozen listed traps |
| **Backend** — one interface, ~14 methods, over the store's catalogue, cart, profile, orders | new code, the only real design work | the bulk of the risk |
| **UI** — protocol mirror, turn state machine, six cards, panel | copy-and-adapt from upstream's TypeScript | mostly restyling and i18n |

The value of the port is not the tool-calling loop — that is fifty lines. It is
the **20 enforced trust-safety rules** (`docs/safety.md`) and the presentation
contract underneath them: the model supplies **ids and prose only**, and the
server joins every displayed fact from records a tool returned this session. A
bare loop that casts tool input with `as` and lets the model author a price is
not a cheaper version of this; it is a different, unsafe thing.

Read `docs/safety.md` before you write anything. Sixteen of its twenty rows
apply to the shopping role (four are merchant-only: staging provenance,
guardrails, host approval, analysis delegate).

### Upstream map

| Upstream path | What it is |
|---|---|
| `commerce-common/commerce_common/` | role-independent core: `fencing`, `streaming`, `presentation`, `prompt_assembly`, `grounding`, `execution`, `turn`, `memory`, `skills`, `config`, `types`, `testing` |
| `shopping-agent/core/shopping_agent/` | the shopping role: `backend`, `types`, `config`, `prompt`, `fencing`, `gates`, `grounding`, `enrichment`, `serialization`, `executor`, `memory`, `tools/registry`, `tools/presentation` |
| `shopping-agent/runtime-messages-api/.../orchestrator.py` | the turn loop |
| `shopping-agent/skills/*/SKILL.md` | the five conversational flows |
| `examples/web-shared/` | the client: `protocol.ts`, `turn.ts`, `api.ts`, `scroll.ts`, `Markdown.tsx`, `QuotedAsData.tsx`, `Transcript.tsx`, `MessageBubble.tsx`, `Suggestions.tsx`, `Composer.tsx`, `base.css` |
| `examples/retail/storefront-web/` | a worked Next.js storefront and the card components |
| `examples/demo_common/sessions.py` | the session store contract |
| `docs/backends.md`, `docs/safety.md`, `docs/deployment.md` | the three docs worth reading in full |

### The tool surface

Twenty-two tools in a **fixed order**, plus an optional web-search tool. The
list is a pure function of the deployment config, so it is the same bytes on
every request; whether a capability can serve a call is decided in the
executor, which refuses any name not in the list.

| Group | Tools | Removed by |
|---|---|---|
| flow loading | `load_skill` | — |
| catalogue | `search_products`, `get_product_details` | never — this is the floor |
| cart | `get_cart`, `add_to_cart`, `update_cart_item`, `remove_from_cart` | the cart switch (also removes `checkout`) |
| profile | `get_preferences` | — |
| orders | `get_orders`, `get_order_status` | the orders switch (also removes `present_order_status`) |
| terms | `search_policies` | the policies switch |
| fulfillment | `get_fulfillment_options` | the fulfillment switch |
| memory | `save_memory`, `recall_memories` | nothing — they stay **registered** and change behaviour instead, so turning memory off costs no prompt bytes and no cache miss |
| presentation | `present_products`, `present_comparison`, `present_plan`, `present_guide`, `present_order_status`, `checkout`, `present_suggestions`, `present_disclosure` | `present_disclosure` unless disclosures are on |

Two shapes to preserve:

- **Every non-presentation tool takes an optional `status` first** — a few words
  the person waiting sees while the call runs. First matters: key order in the
  tool JSON is prompt bytes.
- **`checkout` is a presentation tool.** It stages a summary; it places nothing.

Five skills ship as `SKILL.md` flows — search and discovery, purchase research,
planning and goals, customer care, memory personalisation. Only the **index**
(one line each) goes in the static prompt; a body arrives on demand through
`load_skill`. That split is the point: the bodies are ~17 KB, and putting them
in every request would cost more than it buys.

### Adding a card of your own

Two rules make the difference between an extension and a fork.

**Append; do not interleave.** Keep the vendored tool builder and component
table exactly as upstream renders them, and put host tools and components in
their own modules that are merged in afterwards. The array order is prompt
bytes, and the byte-level pin on the upstream render is what lets a reviewer
tell an accidental edit from an intended one — a host tool inside that builder
breaks the pin *and* the pin's meaning. Appending also moves nothing that was
already there, so the only cost is the one-time cache rebuild any new tool
implies.

**Give the enrich hook something to refuse.** Every built-in hook stops the
model asserting a *fact* it did not read. A card about the session's own state
should stop it asserting the *state*: a sign-in card, for instance, is refused
for a shopper who is already signed in — held rather than errored, so the model
is told the state and can answer in the same turn. A hook with nothing to check
is a sign the card is carrying model-authored data it should be joining instead.

Two smaller things, both learned the hard way:

- **A card whose action leaves the conversation must use a client-side link.**
  The provider usually lives in the root layout, so a client-side navigation
  preserves it — the panel stays open and the transcript stays on screen. A full
  page load throws both away, and because the client never re-reads the stored
  transcript, the shopper returns to an empty conversation the assistant
  nonetheless remembers.
- **A responsive variant needs a container-query ancestor**, or it silently
  never applies. Check the computed style, not the class list.

---

---

## Decide these before writing code

Each of these changes what you build. Write the answers down; several are
irreversible-ish because they are prompt bytes (see **Prompt bytes are frozen**
below).

| Decision | Why it has to be up front |
|---|---|
| **Which systems the store actually has** — cart, orders, policies/help corpus, fulfillment, disclosures | Each is a config switch that removes a tool, its prompt lines, *and* its grounding rule. A system that exists but is not wired yet stays **on** (its method throws and the tool reports itself unavailable); a system the store does not have at all goes **off**, so the model says "we don't offer that" instead of "try again later". |
| **Whether you have a policy corpus** | With policies off you lose `search_policies` and the policy grounding gate, and two of the five skills degrade *by design* — they are written to say "when the terms do not address the question, say so". Acceptable for a first release. Do not fake a corpus. |
| **What a product id is** | The single most consequential backend decision. See `references/backend.md` — most platforms need two or three id shapes, and the family/variant split has to agree with whatever the product page does. |
| **Which model** | The turn model is a config string. Post-turn memory extraction can run on a cheaper, faster model. Do not assume a model's feature support from its family name; gate optional request fields on an allowlist (see below). |
| **Host request ceiling** | A serverless platform with a hard synchronous limit (Netlify: 60s, not configurable) forces four settings down from upstream's values. See `references/runtime.md`. |
| **Streaming or buffered transport** | Whether the host actually delivers SSE frames incrementally is an *observed* fact, not a documented one. Phase 0 settles it. Upstream anticipates a buffered shell, so only the route file differs. |
| **Order placement** | The reference deliberately has **no** order-placing tool. The `checkout` component renders the bag and the host completes it. If someone remembers a previous chat that could place orders, tell them this is a removal on purpose, not a gap. |

---

## The invariants that fail silently

Every item here has shipped as a bug in a real port. None produces a type error,
an exception, or a failing test unless you write the test.

1. **The model must never author a displayed fact.** Every presentation payload
   carries ids; the server joins title, price, rating, image, stock from
   provenance. If you find yourself adding a `price` field to a presentation
   tool's schema, stop — that is the contract breaking.

2. **An empty result means "nothing matched".** So a search backend whose index
   is disabled, unreachable, or unconfigured must **throw**, never return `[]`.
   Returning an empty list makes the model state that the store does not sell a
   category it does sell, and then reason from that.

3. **Never return a stand-in zero.** A rating the platform does not have is
   absent, not `0.0` — a `0.0` renders as one star and is a lie. Same for
   review counts, delivery estimates, tracking URLs. `docs/backends.md` Step 6
   is about exactly this.

4. **Availability is "not explicitly false", not "explicitly true".** On
   platforms where stock tracking is optional, an untracked variant carries no
   availability object at all, and `=== true` marks the whole untracked
   catalogue dead. Whatever rule the product page uses, the agent must use the
   same one — it is one more surface, not a new convention.

5. **Two serializers, two audiences.** The model-facing product serializer drops
   image URLs, slugs and category to save prompt bytes on every search result.
   The card-facing one carries the whole record. Building the card payload on the
   compact one ships every product tile with no image, and no test notices
   because nothing asserts on a field the model never sees.

6. **Money crosses a units boundary.** Upstream's domain model is a **float in
   major units** (`349.0` = $349). Most commerce platforms and most formatting
   helpers use **integer minor units** (`34900`). Both are `number`. Handing one
   to the other renders **$3.49 for a $349 sofa** with no error. Confine the
   conversion to exactly two modules — one inbound from the platform, one
   outbound to the view — and do not copy upstream's own `formatMoney` into your
   tree at all, so it cannot be reached by accident (it hard-codes `en-US` and
   several of its callers pass no currency).

7. **The line's effective unit price is `lineTotal / quantity`**, not the
   catalogue unit price. Only then does the agent's derived
   `lineTotal = price × quantity` reproduce the platform's own line total. Using
   the catalogue price makes every line wrong by the per-line discount.

8. **A cart subtotal the model sees may differ from what the shopper owes.** If
   the platform does not distribute whole-cart discounts across lines, the sum
   of line totals *exceeds* the payable amount. That is safe only because the
   model never renders money. Give the card its own cent-exact payload, built by
   the same helper the cart page uses, and render that.

9. **Prompt bytes are frozen.** Anything that renders into the static system
   prompt or the tool list must be constant within a deployment — never read
   from an environment variable — or every request pays for a cold cache. Only
   non-prompt caps are safely overridable at runtime.

10. **Do not assume model feature support.** If the model id is a deployment
    setting while an optional request field (extended/adaptive thinking, a
    server tool version) is static, gate the field on a **family allowlist**,
    and make the default for an *unrecognised* id **not to send it**. The
    asymmetry is the whole point: omitting the field costs some quality on hard
    turns, while sending it to a model that rejects it is a 400 on *every* turn
    — and from outside it looks exactly like a bad API key.

11. **The transcript is server-owned.** Never accept a `messages` array from the
    browser. The stored history contains tool-result blocks whose content is
    fenced third-party text, so a client-supplied transcript lets a caller
    inject arbitrary text into model context *disguised as a past tool result*.
    Provenance still holds, but the injected text arrives unfenced, which
    defeats the fencing entirely. A turn is one `{ message }`.

12. **Fenced output has a hard character cap and truncates without an error.**
    A family with many variants can exceed it, and the model then believes it
    has the whole list and tells a shopper a size does not exist. Measure the
    widest payload against the real catalogue with a script, in CI. If it
    exceeds, reduce what a row keeps or paginate — do not raise the cap, which
    is a prompt-bytes constant behind a cache breakpoint.

---

## Phases

Each phase ends with something runnable and a gate you can fail.

**Phase 0 — the transport gate.** Before porting anything, deploy a throwaway
route that emits one SSE frame per second for slightly less than the host's
ceiling, and verify **on a real deploy** with `curl -N -i`: headers flush
immediately, frames arrive one per second rather than in one burst, the
connection survives, and it dies near the ceiling. Local dev hides host
buffering. If frames arrive batched, take the buffered transport — same
orchestrator, events collected into one JSON body, partial frames dropped. Also
confirm your typecheck and build are green *now*, so later breakage is
attributable. → `references/runtime.md`

**Phase 1 — shared extractions.** Before the agent exists, lift the logic it
will need to agree with out of the UI components that currently own it: variant
option derivation, fulfillable shipping-method filtering, active-cart
resolution, search clause construction. Each is independently mergeable and
removes a duplicate-implementation hazard whether or not the agent lands. Any
module the agent's server side imports must not be a client-only module.

**Phase 2 — the pure core.** Port with no credentials and no network: fencing,
streaming and partial-JSON parsing, domain types, the skill loader, prompt
assembly, grounding matchers, config, serialization, the tool registry, the
presentation schemas, and the client-side protocol mirror. Upstream's unit tests
port straight across and become your deploy gate.
*Gate:* build the prompt and tool list **twice and compare bytes**; assert the
cache markers land on the last tool and the static system block; assert that
changing a non-prompt setting changes nothing. → `references/porting.md`

**Phase 3 — the backend.** Implement the interface over the store's systems.
*Gate:* a script that prints each method's exact serialized payload against the
real catalogue, and asserts the family/variant round trip — search returns a
family once, details lists its variants, a family id is refused for a cart
write, a variant id succeeds. Settle the id-pattern lexicon against real ids
here; if none of your patterns can match, turn the catalog grounding gate
**off** rather than shipping a rule that silently never fires. Measure the
fenced-payload cap. → `references/backend.md`

**Phase 4 — session and memory storage.** Provenance state and the transcript
must be loadable by a request on another process. A module-level `Map` is not a
store when functions scale horizontally.
*Gate:* force a write conflict and assert it is refused; round-trip a record
with every optional field absent; measure the stored size at the provenance cap.
→ `references/runtime.md`

**Phase 5 — gates, presentation, executor, memory.** The trust-safety layer.
*Gate:* upstream's suites, plus one your language needs and Python did not — two
concurrent cart adds for one session in a single `Promise.all`, asserting the
per-item cap still holds.

**Phase 6 — the turn loop.** *Gate:* upstream's fake-client tests, plus three
that are specific to a JavaScript port: a non-JSON streamed tool input reaches
the salvage path; abandoning the generator runs its `finally` and pairs every
open tool call with a result; no unhandled rejection escapes a cancelled round.
Then **one real three-turn conversation** — cache reads must be non-zero on
turns 2 and 3, or the cached prefix is moving.

**Phase 7 — routes and transport.** *Gate:* `curl -N` locally, then on a deploy.
Frames incremental, the turn inside the deadline, `turn_complete` present, and
the session cookie written with the right attributes on **every** route that
touches it.

**Phase 8 — UI.** Build the fixture-driven showcase page **alongside the first
card**, not after: every card × every slot state × every locale is otherwise
unreachable without paying for a model turn *and* hoping the model picks that
card. Review the cards at **panel width**, not page width. → `references/ui.md`

**Phase 9 — mount, remove the predecessor, document.** Build the new provider
*first*, so swapping the old one is a one-line change with no functional gap.
Make the chat context hook return a **no-op default** when no provider is
mounted, rather than throwing, or the header crashes whenever the surface is
off.

---

## Verification

The happy path proves almost nothing here. → `references/verification.md`

At minimum: prove each gate (an id the session never saw → held, not written; a
family id → the options hold; an absurd quantity → the cap), prove the money in
every currency you serve, prove the prompt cache is being read, and prove the
tool list matches the config.

---

## Licensing

Ported and adapted files keep their upstream copyright line, an
`SPDX-License-Identifier: Apache-2.0`, and a one-line "Adapted from
`<upstream path>`; changes: …" — §4(b) of Apache-2.0 requires stating changes,
and that line is also what makes the file diffable against upstream later. Add
the full licence text under a `third_party/` directory and list the vendored
paths in a `NOTICE`. If the host repo publishes under a different licence, or
has a publishing gate that flags foreign copyright, keep the vendored files in
as few directories as possible and declare those paths — and run that gate
*before* merging, not after.

---

## References

- `references/porting.md` — module-by-module port notes: the translations that
  are **not** mechanical, and what not to port at all.
- `references/backend.md` — the integration surface: every method's real
  contract, the id scheme, money, search, orders, and the "return nothing"
  discipline.
- `references/runtime.md` — turn loop, prompt-cache layout, session and memory
  storage, the route surface, abuse controls, and serverless constraints.
- `references/ui.md` — the streaming protocol, the slot state machine, the six
  cards, tokens, i18n, and where cart-add instrumentation belongs.
- `references/verification.md` — what to test, and the proofs that catch the
  silent failures.
