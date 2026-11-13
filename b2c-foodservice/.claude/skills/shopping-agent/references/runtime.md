# Runtime: turn loop, caching, storage, routes

## The turn loop, in one paragraph

Per iteration: build the request (static system block + per-request context
block, the fixed tool array, the conversation with a rolling cache marker),
stream it, relay text deltas and partial card frames to the host as they arrive,
**dispatch each tool call the moment its content block closes** so tool time
overlaps generation time, join the started calls after the stream ends, execute
anything the stream path missed from the final message's canonical arguments,
emit each outcome's events and tool result, append the assistant message and the
tool-result message to the conversation, and stop when there are no tool calls —
or when a round of clean presentation calls including the suggestions call ends
the turn with no closing model call at all.

That last mechanism is worth understanding before you debug the UI: **a turn can
legitimately produce no prose.** The cards and chips are already rendered, so
asking the model for a closing line would only add latency to a finished reply.
A test that asserts "the reply contains some text" will fail correctly.

## Grounding

Certain message shapes must start from a read tool. A rule reads the user's
latest message and names one tool; the runtime forces the first rule that fires
with `tool_choice` on the turn's **first** iteration. Precedence: a terms
question → policy search; a post-purchase question → order history; a mention of
a product id the session has not resolved → the detail read.

Two things to get right:

- **The intent lexicons are config, not prompt bytes**, so extending them costs
  no cache hit. If the store serves more than one language, extend them per
  language — a gate that cannot match what the shopper typed simply never fires,
  and the model then answers a return-window question from its own head. That is
  the exact failure grounding exists to prevent, and it fails silently.
- **The id patterns must match real ids.** Upstream's are shaped for its demo
  SKUs. Measure yours; a pattern requiring three digits will match almost
  nothing in a catalogue whose SKUs have one or two. Keep the digit ceiling low
  enough that order numbers do not match. If no pattern can match your id shapes
  at all, turn the catalog gate **off** rather than shipping a rule that never
  fires.

An id the session already resolved needs no forced re-read; compare
case-insensitively.

## Prompt caching: three breakpoints

1. **The tool array** — marker on the *last* tool, so the whole array caches.
   It is the outermost stable prefix.
2. **The static system text** — identity, the always-on rules, the trust rules,
   the skill index. Built **once per process**. Every conditional in it must
   read deployment config only.
3. **A rolling marker on the newest persisted content block** of the
   conversation, so a turn's later rounds read its earlier rounds — the long
   tool results especially — instead of reprocessing them.

Everything per request (profile, cart, page, clock, memory facts, account
context) goes in a **second** system block, *behind* the static one's marker.
That block is the same bytes from one turn to the next until the state in it
moves, so a turn whose state has not moved reads the whole conversation from
cache and a turn whose state has moved re-reads it once.

Four traps:

- **A byte's change in the first block re-reads the tool array and the static
  text on every call.** This is the single most expensive available mistake.
  Never render a request value there; never read a prompt field from the
  environment.
- **`tool_choice` keys the cached messages span.** An entry written under a
  forced round is unreadable by the `auto` rounds that follow, so **skip the
  rolling marker on any non-`auto` round.** This is the documented cost of a
  grounded turn, not a bug.
- **Not every content-block kind accepts a cache marker.** A thinking block in
  particular is rejected with a 400, and resuming a paused turn leaves an
  assistant message last. Walk back from the newest block to the newest
  *markable* one rather than marking the last unconditionally.
- **Never persist the marker.** Apply it to a request-shaped copy, strip any the
  previous call left, and never mutate the stored history.

Skip the rolling marker on a single-message first call too: it writes an entry a
one-shot session never reads, and the next call's span covers that message
anyway.

**Verify with the cache-read counter.** Zero on the second turn of a
conversation means the prefix moved. This is the only reliable signal; it does
not announce itself any other way.

## The event protocol

Ten event types: `text_delta`, `tool_call`, `tool_result`, `ui`, `ui_partial`,
`cart_update`, `change_update`, `progress`, `turn_complete`, `error`. Hosts
render what they know and **ignore what they do not** — keep the full union even
for events your deployment never emits, so a reader who greps for an unhandled
type finds a declaration rather than a mystery, and a fork that adds the
merchant role gets the name for free.

Two details that are easy to lose:

- `tool_call` carries an optional `label` — the model's few words for the person
  waiting. It is split off the arguments **before validation, gates, or handlers
  run**, on every path, because it is model display text and must never reach a
  backend, a gate, memory, or a tool result. Presentation calls carry none.
- `tool_result` carries a `status` of ok / error / **blocked**, and `blocked`
  names the gate. A held call is a *normal* result with a status, not an error:
  the model is told which rule stopped it and what to do instead, and the turn
  continues.

A long successful result is summarised as `ok` plus an excerpt — the whole
fenced payload is already in the model's context and does not need to cross the
wire to the browser as well. A **refused** result keeps its full text: that text
is the instruction the person may need to see.

## Serverless: the settings the host ceiling forces

If the host has a hard synchronous request limit that is not configurable
(Netlify: 60s), four of upstream's numbers cannot ship as-is. None of them is a
prompt-bytes field, so none costs a cache hit:

| Setting | Upstream | With a 60s ceiling |
|---|---|---|
| per-call request timeout | 120s | ~40s — a hung call still leaves room to emit an error *and* `turn_complete` |
| max tool iterations | 8 | ~4 — four rounds at 6–10s fits, eight does not. Closing on a presentation round already removes the final call, so a normal two-or-three-round turn is unaffected |
| provenance cap | 200 | much lower (≈60) — read and rewritten every turn |
| *new:* turn wall-clock deadline | — | ~48s, checked **between** rounds; past it, run one final round with tools disabled so the turn ends in prose rather than being severed |

A severed turn loses its `turn_complete`, and that event is load-bearing (below).

**Iteration caps are a runaway guard, not a budget.** A multi-part request has
to finish well inside the cap, because once the cap forces a tool-less round the
model tends to *describe steps it never performed*.

### Background work does not exist

A serverless function is frozen or killed the moment its body ends, so
upstream's "spawn a background task for memory extraction after the response"
never runs. Three options; take the third:

- inline before `turn_complete` — spends another model call inside the budget on
  exactly the turns most likely to be near it;
- fire-and-forget — killed;
- **a second short request the client makes on `turn_complete`.**

That reorders one thing: **persist the session immediately *before* yielding
`turn_complete`**, not after the response ends. Three benefits, and the middle
one is the reason:

- `turn_complete` becomes the client's durability guarantee, which is what makes
  it safe to fire the extraction request on it;
- a function killed at the ceiling has written **nothing**, so the stored
  conversation is byte-identical to its pre-turn state — safe, because the next
  turn simply re-asks rather than resuming on a dangling tool call;
- a failed write surfaces as an error frame instead of vanishing.

If a turn compacted the conversation (cleared old tool results), the transcript
must be rewritten **whole**, or the store keeps the uncompacted prefix and the
next turn resends what the turn just cleared. `turn_complete` reports how many
results were cleared for exactly this reason.

### Loading skill bodies on a bundler-based host

Reading `SKILL.md` files with `fs` at runtime depends on the framework's file
tracing bundling files nothing imports. **A tracing miss does not fail** — it
yields an empty registry whose index block is a literal "(no skills installed)",
and that string is then baked into the *cached* static prompt. The agent runs
every turn with no flows and no error anywhere.

Generate a source module from the markdown at build time and import it, with a
staleness check in the same gate as typecheck. Keep the `.md` files as the
source of truth so they stay diffable against upstream. Whatever you do, **fail
loudly** if the skills are missing.

## The transport

Two response shapes behind one runtime switch, so the answer to Phase 0 can be
applied to a deployed site without a code change:

- **SSE** — `text/event-stream`, frames as they happen. Send a comment frame
  immediately so the headers flush before the first model token, and a heartbeat
  comment every ~15s: a model call can run for seconds with no events, and an
  idle connection is what intermediaries drop. Set `Cache-Control` to include
  **`no-transform`** as well as `no-cache` (it asks intermediaries not to
  re-encode the body, which is what buffers a stream), and the
  nginx-family opt-out header that disables proxy buffering.
- **Buffered** — the same turn's events collected into one JSON body, with
  partial frames dropped (they only mean something to a client watching frames
  arrive, and the final event for the same call carries the complete payload).

Consume the generator **inside** the stream's start callback, and call `.return()`
on it in the cancel callback — that is what runs the orchestrator's `finally`,
and so what pairs any open tool call with a result. Without it, a shopper who
closes the tab leaves a stored conversation the *next* request cannot send.

Have the client **branch on the response's content type**, not on a build-time
flag, so one bundle is correct either way and a fork can flip the server setting
without shipping a matching client.

## The cookie / cart ordering problem

If the store keeps its cart id inside a signed session cookie, there is a
sequencing constraint that is easy to discover the hard way: **an SSE response's
headers flush before its body starts.** A cart created part-way through a turn
therefore cannot set the cookie carrying its id — it is created, written to, and
lost on the next request.

So **resolve the cart before the stream opens**, in the plain-JSON session-start
route. Then every mid-turn cart write is an update to an id already in the
session. The chat route re-checks and, if the id did change, writes a **raw
`Set-Cookie` header** — a streamed response has no cookie-jar API.

And pass the cross-site cookie attributes at **every** cookie write, on every
route that touches the cart. If the storefront is ever embedded in an iframe from
another origin, a `SameSite=Lax` rewrite inside that frame is silently dropped by
the browser *along with the cart id*, and the symptom is indistinguishable from a
failed handshake. Count the writers; there are usually more than you expect.

## Session and memory storage

The session is stored as **two things**, so any process can find it: a small
state document (the principal, the provenance state) rewritten under a version
guard only when it changed, and the transcript, which a request appends to.

Write the state document **first**, under the version check, whenever it changed
or the transcript grew — so a request that lost a race writes nothing at all —
then append the messages the store lacks. The other order leaves a transcript
the state document does not account for.

**Session start is the only place a principal enters the store.** It binds the
principal the host already authenticated (read from the signed session, never
from a request body), mints an unguessable id, and writes that id back into the
signed cookie. Every later request carries only the id, so no request shape and
no tool argument names a user.

Two storage subtleties that have both cost real debugging time:

- **Have the compare-and-set write *return* the version now held**, rather than
  the caller predicting `version + 1`. Some stores do not bump a version when
  the value is unchanged — a save that only grew the transcript rewrites the
  same state document and comes back at the version it went in at. Predicting an
  increment there makes the *next* save send a version the store never reached,
  which it correctly refuses as a lost race.
- **Some stores drop fields whose value is null.** That aligns by luck with
  upstream's "exclude none" dumps; make it deliberate — mappers and serializers
  use omission, never null — and add a round-trip test for a record with every
  optional field absent.

Serialize the provenance record as an **array in insertion order**, not an
object. Eviction order *is* insertion order, and JavaScript hoists integer-like
string keys, so a catalogue with numeric SKUs would round-trip through storage
and come back evicting in an order nobody chose.

**Memory:** the store contract is six methods (get / upsert / search / delete one
/ clear / purge-generation). Two rules carry safety weight:

- A **write filter** refuses identifier-shaped keys and values by default —
  long digit runs, IBAN shapes, email addresses. Memory is a place for "prefers
  charcoal" and "two cats"; a model that has just been told a card number will
  otherwise happily remember it.
- Post-turn extraction reads the **purge generation before and after its model
  call and discards the batch if it moved.** Without that, a customer who asks
  to be forgotten mid-turn has their facts re-created by the extraction already
  in flight.

Extraction reads the user's and assistant's **text** of the last exchange,
never tool results. A stored fact carries a **digest of the writing session**,
not the session id — the id is also the request credential.

Keep facts for **guests in-process**, deliberately: nothing about an
unidentified visitor should be written to durable storage.

## Logging

Every model call logs one line: round, model, stop reason, the four usage
counters, elapsed time, and a **digest of the session id — never the id itself**,
because the id is the request credential. A digest still lets one session's lines
be correlated, and lets an operator holding the id compute the tag, without
allowing the reverse.

Log a tool failure with the **tool name only**. Arguments can carry catalogue
text and the session's own data. Log an unreadable streamed input by its
*size*, never its content.

Note for whoever runs the logs: a request body contains every injected memory
fact and the whole cart, so debug-level body logging needs the retention and
access controls of the memory store.

## The route surface, and abuse control

A minimal set: start/end session, one turn, the post-turn extraction, a memory
read/edit/delete surface if the store exposes one, plus two routes the *cards*
need — a product detail read and a cart add.

Those last two deserve their own justification, because "why not reuse the
existing routes" is the obvious question:

- **The card's add route is not the site's add route.** The site's takes a
  platform product id plus a variant id; a card carries an *agent* id, which is
  one of three shapes and only the server can resolve. The browser must not be
  taught that mapping.
- **It is also not a chat turn.** Sending "add the sofa" as a message routes a
  button press through the model: several seconds and a paid turn for an act
  whose meaning is already unambiguous. A shopper clicking Add on a card should
  get the same latency as clicking Add on a listing tile.
- **Which gates apply there:** the quantity cap and the options hold **do**;
  provenance does **not**. Provenance authorises the *model's* writes, because a
  model can name an id it never read. A human clicking a card this server itself
  composed is not that threat, and gating it would break the honest case of a
  shopper expanding a card in a tab restored from yesterday whose agent session
  is gone.
- The card's detail read is likewise not provenance-gated: it reads published
  catalogue data the product page serves to anyone. But it must use the **same
  serializer** the streamed card payloads use, or an expanded panel can disagree
  with the tile above it.

**Abuse control.** Every turn calls a paid API and the routes are reachable by
any anonymous cross-origin caller. Two layers, neither of which ships a secret:
same-origin enforcement (a browser always sends `Origin` on a POST `fetch`; a
script hitting the endpoint usually sends none — a missing or foreign
origin/referer host is 403), and layered rate limits.

**Budget the routes by cost class, not with one shared limit.** Three classes:

| Class | Routes | Why |
|---|---|---|
| **turn** | the chat route | holds a function open for seconds and makes several model calls |
| **memory** | the extraction route | one small, cheap model call — but the *client fires it after every turn*, so its budget must keep up with turns rather than compete with them |
| **support** | session, card detail read, card cart add, memory read | one platform read or write each — the same cost as the store's own cart and product routes |

One shared limit is a real defect twice over: an engaged shopper who expands four
product cards in a turn spends four detail reads plus a session plus an
extraction plus the turn, and their *second question* rate-limits them out of
their own conversation; and because extraction fires after every turn, a shared
budget halves the real turn allowance.

Make **turn** the default class, so a route that forgets to declare its class is
billed as if it were expensive.

Two ordering rules:

- **Call the guard first, before the feature-flag check.** The other order means
  a disabled deployment never exercises the guard, so its coverage looks
  complete on a run where every request was refused for a different reason.
- **A disabled deployment answers 503 with a named error, not 404.** A 404 is
  indistinguishable from "the route was removed", and that ambiguity lets a test
  run be green while asserting nothing.

Counters in process memory are enough to bound one instance. The durable
backstop is a hard spend cap on the API account — say so out loud rather than
implying the rate limiter is one.
