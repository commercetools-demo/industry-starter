# Porting the core

Read with the upstream tree open. Keep the module names — a reader who knows the
reference should be able to find their way, and a later upstream diff should be
readable.

## Module inventory

Role-independent (`commerce-common/commerce_common/`):

| Module | Carries |
|---|---|
| `fencing` | sanitizing and wrapping third-party text; the label class; chip and label sanitizers |
| `streaming` | the event union, the tool-outcome type, SSE framing, partial-JSON parsing |
| `presentation` | the component spec, the one runner that validates → enriches → emits, partial-frame signatures |
| `prompt_assembly` | where the cache breakpoints go; the session clock; per-call request shaping |
| `grounding` | term/cue matching, id-pattern search, rule precedence |
| `execution` | the executor frame, the failure ladder, tool-shape helpers, argument clamps |
| `turn` | eager dispatch, the streamed-round accumulator, usage accounting, history compaction, transcript helpers |
| `memory` | the store contract, the write filter, validation, retention, post-turn extraction |
| `skills` | `SKILL.md` frontmatter parsing and the registry that renders the prompt's skill index |
| `config` | the shared config fields; which are prompt bytes |
| `types` | memory facts, the provenance cap and its insertion-ordered remember helper, clock context |
| `testing` | a fake model client — what lets the whole turn loop be tested with no key and no spend |

Role-specific (`shopping-agent/core/shopping_agent/`): `backend`, `types`,
`config`, `prompt`, `fencing` (the role's one fence label + notice), `gates`,
`grounding`, `enrichment`, `serialization`, `executor`, `memory` (the extraction
prompt), `tools/registry`, `tools/presentation`. Plus the turn loop in
`runtime-messages-api/`.

## Copy verbatim, do not paraphrase

- **The system prompt and every tool description.** Each clause is doing a job
  the safety table depends on. There is an explicit layering rule: a rule about
  filling one tool call belongs in that tool's description; a rule that applies
  on most turns belongs in the prompt; a multi-step procedure for a minority of
  requests belongs in a skill. Breaking that layering is how a prompt becomes a
  pile. Rewording the search-result header, in particular, changes behaviour —
  it is what stops the model presenting a related item as the thing asked for.
- **The five `SKILL.md` flow files**, byte for byte. They are written to be
  catalogue-agnostic ("item" means whatever this catalogue sells), so there is
  usually nothing to localise, and keeping them identical is what lets them be
  diffed when upstream moves.
- **The gate and executor message strings.** They are model-facing instructions
  that turn a refusal into a retry rather than a dead end.
- **Key order in every serialized payload.** It is part of the prompt bytes.
  Spell the dumps out as ordered literals rather than trusting a generic
  object walk.

## The translations that are not mechanical

These are the ones that cost a day each if you discover them late. Comment each
at its site.

### Regex and text

- **Invisible-character ranges span astral code points.** In JavaScript the
  Unicode flag is load-bearing, not stylistic: without it a `0`-style
  escape parses as a different, much *wider* range, and the class starts eating
  ordinary letters — so dropping the flag does not merely let tag characters
  through, it mangles the surrounding text.
- **A cached global regex carries `lastIndex` between `.test()` calls** and
  skips matches. Cache non-global patterns, or only ever use them with
  `String.replace`. Python's `@cache`d pattern has no such hazard.
- **`\b` and `\w` are ASCII-only in JavaScript and Unicode-aware in Python 3.**
  A word-boundary match around a non-ASCII letter behaves differently on the two
  sides. Do not emulate it; note the divergence, pin it with a test, and where
  it matters (intent lexicons) carry both the accented and accent-free spellings
  — a missed term only costs one wording, and a false positive only costs one
  forced read.
- **Object key order.** JavaScript hoists integer-like string keys ahead of
  every other key. If a catalogue has numeric attribute names or numeric SKUs,
  a payload built by walking an object comes out in a different order than
  Python's, which is a silent prompt-cache miss. Pin it with a test rather than
  hoping.
- **`str.replace(" ", "_")` replaces every occurrence in Python; JavaScript's
  string-argument `replace` replaces the first.** Use `replaceAll`.
- Python loops the marker-strip to a fixpoint unconditionally. On a request path,
  give it a hard pass ceiling instead of trusting every future pattern to
  converge.

### The stream

- **Hand-port the partial-JSON parser.** SDKs ship a tolerant parser, but it
  closes an open string *where it stands* — the reference instead drops a
  half-written string **together with its key**, which is the whole anti-flicker
  point. A half-written title rendered then corrected is a visible flicker; a
  half-written id is a card that briefly points at the wrong product. Keep the
  option to close-in-place for the eager-frames mode, but do not make it the
  default.
- **Usage counters on a stream are cumulative.** The latest value of each key
  **replaces** yours; adding them multiplies the reported tokens by the number
  of delta events.
- **A malformed streamed tool input throws from inside the async iterator.** The
  TypeScript SDK installs `.input` as a memoized getter over its tolerant parser
  and reads it at block close, so the exception arrives *before* you see the
  stop event. The mechanism differs from Python's (where the accumulator parses
  on every delta) but the outcome is the same, so the reference's
  abandon-and-salvage branch is still correct: keep your own raw buffer, parse
  it **strictly**, rebuild the round from what did arrive, and answer the
  unreadable call with an error so the model sends it again. Never echo the
  unparsed input back — it is model text that failed to parse, and quoting it
  invites the same bytes.
- **Never eager-dispatch off the SDK's tolerant `.input`.** Dispatching a cart
  write on a half-written object is a write with the wrong quantity.

### Concurrency and lifetime

- **Promise cancellation does not exist.** The reference's `task.cancel()`
  cannot be ported. Do two things instead: raise an `AbortSignal` the backend can
  honour, and attach a rejection handler at *storage* time to every dispatched
  promise. That second part is not tidiness — in Node an unhandled rejection
  terminates the process by default, which on a shared serverless instance takes
  down every other in-flight request.
- **An `asyncio.Lock` becomes a promise-chain mutex.** And it is genuinely
  needed in single-threaded JavaScript: a round's tool calls are dispatched
  concurrently, so two cart adds interleave at every `await`, both read the same
  "before", and the line lands over the cap. Chain with `.then(fn, fn)` so a
  failed predecessor cannot wedge everything behind it, and delete the map entry
  only if it is still the tail — otherwise you leak one entry per session per
  warm instance. Note what it does *not* do: it covers one process, so the
  backend's cart writes also need the platform's own optimistic concurrency.
- **There is no `async with`.** The generator's `finally` must abort the stream
  itself, and the route must consume the generator inside the response stream and
  call `.return()` on cancel — otherwise an abandoned browser request leaves it
  suspended at a `yield` for ever, and the stored conversation is left ending on
  a tool call with no result, which the API rejects outright on the *next*
  request.

### Time and money

- **The session clock string includes the offset** (`2026-09-03T11:00+02:00`).
  JavaScript has no timezone-aware datetime, so format the parts in the
  session's zone and reassemble. Give it a byte-equality test — getting it wrong
  shows up only as a cache-read regression. Render the **hour**, not the minute,
  or the context block changes on nearly every turn.
- **No clock means no local-time line at all.** The server's clock is not the
  shopper's, and a wrong "today" makes a return-window answer wrong. Validate a
  client-supplied zone before trusting it; an unknown zone means no line.

## Validation: where a schema library earns its place

Add one for the **presentation payload schemas** and for **model-supplied filter
arguments**. Those two earn it because a rejected payload is fed back to the
model, which retries — that retry loop is a safety rule, and the validator's
message is what makes it work. Prefer a library whose error rendering is
readable, because the model reads it.

Do **not** use it for config. Upstream forbids unknown config fields so a
misspelled name fails at construction; a closed interface plus a compile-time
exhaustiveness assertion gives you that *at compile time*, which is strictly
stronger — provided typecheck is actually a deploy gate. If a deployment ever
reads config from a remote document, add a parse at that boundary only.

Do not use it for domain records either: they need explicit serializers for
byte-stable payloads, and a schema library will not give you key order.

## Deliberately not ported

State these out loud, because each looks like an omission:

- **The merchant role** and its delegation machinery — a different agent.
- **The Agent-SDK and MCP-server runtimes** and the deployment manifests — other
  runtimes for the same core.
- **Web search**, unless the store wants it: it is prompt bytes, widens the
  injection surface, and buys little for a catalogue question.
- **Disclosures**, unless there is a real per-product regulated-facts source. A
  disclosure is a box the backend authors **in full**; inventing rows is the
  stand-in-zero failure with legal consequences.
- **A filesystem skill walk**, on a bundler-based host — see `runtime.md`.
- **A JSON-file memory store** — no writable filesystem on a serverless host.
- **Upstream's second design system** (`examples/web-shared/ui.tsx`) — see
  `ui.md`.
- **Any order-placing tool.** There isn't one upstream and there must not be one
  here.

## Test-shaped things to bring across

- The **fake model client** from `commerce_common/testing.py`. It is what lets
  the whole turn loop be exercised with no API key and no spend, and without it
  Phase 6 has no gate.
- The fencing, gate, prompt, prompt-assembly, streaming and serialization
  suites. They are the reason the ported behaviour is worth trusting.
- Upstream's role-registry checks: build the prompt and tool list twice and
  compare **bytes**; assert the cache markers' positions; assert a non-prompt
  setting changes nothing.

One language-specific caution: a test runner that transpiles without
type-checking will pass on code the compiler rejects. Run both.

Another: a pure function that lives beside an import which constructs a platform
client at module load cannot be unit-tested at all, because the import throws
without credentials. Split such functions into modules with no client import —
and expect to do this three or four times.
