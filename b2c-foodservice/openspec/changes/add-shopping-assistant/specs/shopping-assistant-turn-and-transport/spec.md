## ADDED Requirements

### Requirement: Stable prompt bytes
The tool list and static system block SHALL be a pure function of deployment config; building them twice SHALL give identical bytes; no environment variable SHALL render into them. Cache markers SHALL sit on the last tool, the static system block and, on `auto` rounds only, the newest markable block.

#### Scenario: Byte stability
- **WHEN** prompt and tools are built twice
- **THEN** the bytes are equal and the static prompt hash matches the pinned value

#### Scenario: Non-prompt setting
- **WHEN** a non-prompt setting (iteration cap, timeout) changes
- **THEN** prompt and tool bytes do not change

#### Scenario: Cache read
- **WHEN** a real three-turn conversation runs
- **THEN** cache-read tokens are non-zero on turns 2 and 3

### Requirement: Event protocol
The turn SHALL stream the ten events of the reference (`text_delta`, `tool_call`, `tool_result`, `ui`, `ui_partial`, `cart_update`, `change_update`, `progress`, `turn_complete`, `error`). A held call is a normal `tool_result` with status `blocked` naming the gate.

#### Scenario: Turn complete
- **WHEN** a turn ends normally, at the deadline, or on error
- **THEN** `turn_complete` or `error` is the last event

### Requirement: Host ceiling
With a 60 s ceiling: model request timeout 40 s, max tool iterations 4, provenance cap 60, turn deadline 48 s checked between rounds; past it one final round runs with tools disabled.

#### Scenario: Slow turn
- **GIVEN** rounds that exceed 48 s in total
- **THEN** the turn ends in prose and is not severed

### Requirement: Durable session
Session state and transcript SHALL be stored so that a request on another process can load them; state writes use compare-and-set and return the version held; a lost race writes nothing; records with every optional field absent round-trip; the provenance record serialises as an insertion-ordered array.

#### Scenario: Write conflict
- **WHEN** two writes carry the same version
- **THEN** the second is refused

#### Scenario: Abandoned turn
- **WHEN** the browser closes mid-turn
- **THEN** the generator's `finally` pairs every open tool call with a result and the next request works

#### Scenario: Persist before complete
- **WHEN** a turn finishes
- **THEN** the session is stored before `turn_complete` is yielded

### Requirement: Transport switch
The turn route SHALL answer SSE (comment frame at start, heartbeat every 15 s, `Cache-Control: no-cache, no-transform`, proxy-buffering opt-out) or one buffered JSON body, chosen by a server setting; the client SHALL branch on the response content type.

#### Scenario: Incremental frames
- **WHEN** `curl -N -i` hits the deployed route
- **THEN** headers arrive at once and frames arrive over time, not in one burst

### Requirement: Session start before the stream
The session route SHALL be plain JSON, bind the principal from the signed cookie, write `agentSessionId` into `malva-session` with the storefront's cookie attributes, and be called on first panel open, not on page mount. A market change SHALL end the agent session.

#### Scenario: No session for visitors who never open the panel
- **WHEN** a page loads and the panel stays closed
- **THEN** no agent session record is created

### Requirement: Skills bundled at build time
Skill bodies SHALL be generated into a source module from the `SKILL.md` files, with a staleness check in the `check` command; missing skills SHALL fail loudly.

#### Scenario: Stale generated module
- **WHEN** a `SKILL.md` changes and the module is not regenerated
- **THEN** `npm run check` fails
