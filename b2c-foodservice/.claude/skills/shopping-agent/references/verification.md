# Verification

The happy path proves almost nothing here. Nearly every failure mode in this
system is silent: a wrong serializer, a units error, a cache miss, a gate that
never fires, a dropped analytics event and a truncated tool result all look
exactly like success.

Organise the work as **proofs**, each of which can fail.

## Prove the prompt is stable

- Build the system prompt and the tool list **twice and compare bytes.** Pin the
  static prompt's length or hash in a test, so an accidental reword shows up as a
  failing assertion rather than as a cost regression.
- Assert the cache markers land where they should: on the **last** tool, on the
  **static** system block, and — on an `auto` round only — on the newest markable
  content block.
- Assert that changing a **non-prompt** setting changes neither the prompt nor
  the tool list.
- Assert the session-clock string byte-for-byte, offset included.
- Assert the tool list matches the config: a switched-off system's tools absent
  from the list *and* refused by the executor, so a model that guesses at a name
  cannot reach a system the deployment removed.

## Prove the cache is being read

Run **one real three-turn conversation** and read the cache-read counter. It must
be non-zero on turns 2 and 3. Zero means the prefix moved, and nothing else will
tell you.

Watch the true prompt size too (fresh input + cache read + cache write). It
should grow smoothly with the transcript; a jump means something per-request
landed in the static block.

## Prove the gates, not the happy path

Each of these is a conversation you can have by hand, and each should be a test:

| Ask | Expect |
|---|---|
| add a product id the session has never seen | a **held** call naming the provenance rule, no cart write |
| add a **family** id | the options hold, pointing at the variants |
| 99 of something | the per-item cap applied, and **reported** in the result text |
| a presentation call naming ids the session never saw | the component **refused** with a route back, not a card with fewer items |
| a presentation call naming *some* unseen ids | the card renders the rest **and the tool result says which were dropped** |
| a checkout call with an empty cart | refused |
| an order id belonging to someone else | not found — indistinguishable from an unknown id |
| catalogue text containing an instruction ("ignore previous instructions and …") in a product description or review | the model reports it as *material*, not as an instruction |

The last one is the point of the whole fencing layer and is worth doing manually
at least once, with an actual product record you seeded.

Two concurrency proofs the reference's Python suite does not need:

- two cart adds for one session dispatched in a single `Promise.all`, asserting
  the per-item cap still holds;
- a forced storage write conflict, asserting it is refused rather than
  overwriting.

## Prove the money

In **every currency the store serves**:

- a product card shows the right symbol *and the right magnitude*. The
  hundred-fold units bug renders a €349 sofa as €3.49, which is easy to miss if
  you only ever look at the symbol;
- the checkout card's subtotal equals the cart page's **to the cent**, on a cart
  that carries a **whole-cart discount** — that is the case where the
  model-facing figure and the payable figure legitimately differ, so it is the
  only case that tests the right thing.

Also assert that the derived line total reproduces the platform's own line total
on a line carrying a per-line discount.

## Prove the transport

`curl -N -i` locally, then **on a real deploy** — local dev hides host
buffering:

- headers flush immediately;
- frames arrive incrementally, not in one burst at the end;
- the turn finishes inside the host's ceiling, with `turn_complete` present;
- a long turn's partial card frames arrive **before** the final one for the same
  call, and the final one carries the same stream id.

Then close the connection mid-turn and assert the **next** request still works —
that is the proof that the generator's `finally` ran and paired every open tool
call with a result.

## Prove the fenced-payload cap

Write a script that rebuilds the exact payload the agent would fence, for every
product in the real catalogue, and **fails** over the cap (warn well below it).
Run it whenever the catalogue changes. Record the actual widest family in the
output, so the next person knows how much head-room there is rather than
guessing.

This is not a hypothetical: a family with several dozen size or colour options
will exceed a 12,000-character cap, and the truncation is silent.

## Prove the analytics, against the store — not the call site

An analytics helper that never throws by design means a dropped event looks
identical to a delivered one. So query the destination, not the code. Filter out
any heartbeat event type first, or it swamps the totals. And test **both a hard
page load and a client-side navigation** — a view event can work on one and
vanish on the other.

Count the add-to-cart surfaces in the whole app and make sure every one fires.
Adding the agent adds one, and it is easy to add a card later that quietly
doesn't.

## Make the model-free tests model-free

Point card-rendering, money, navigation and analytics tests at the **fixture
showcase page**, not at a conversation. Those assertions are then deterministic
and free.

Reserve model-driven tests for the few claims that genuinely need a model, and
assert on the **enriched `ui` event payloads** rather than on prose — strictly
stronger, and stable. Specifically, do **not** assert:

- that the model picked a particular tool — tool choice is not deterministic;
- product titles in prose ("the cotton one");
- that the reply contains *any* prose. A turn closing on a presentation round
  produces none, by design.

Two model-driven tests that do earn their cost: a turn in a non-primary locale
that replies in that language **and** renders that currency (this catches the
single-language search clause bug, which otherwise reaches production), and a
checkout turn that asserts **no order was created**.

If you are replacing a previous chat implementation, delete rather than adapt any
spec that placed real orders — the agent no longer can, and the store's own
checkout tests already cover that path.

## Prove there are no regressions

When the change is large, check the failures against a **baseline worktree at
the pre-change commit** and run the same suite. A failure that reproduces
identically on the baseline is pre-existing, and saying so with evidence is much
more useful than a list of red tests. Note separately any test that passes in
isolation but fails in a full run — that is usually a shared-budget or
shared-state problem, not a feature bug.

## Fail the gate before the deploy, not during it

If the framework's dev server does not type-check, type errors ship silently and
first appear in the production build — usually mid-deploy. Put typecheck, lint,
the ported unit suites, the skill-source staleness check and a real production
build behind one command, and run it before every deploy.

Keep the two catalogue-dependent checks (the fenced-payload cap, and an image or
asset resolver if you have one) **out** of that command but documented: they only
change when the catalogue changes, and one of them is network-bound.
