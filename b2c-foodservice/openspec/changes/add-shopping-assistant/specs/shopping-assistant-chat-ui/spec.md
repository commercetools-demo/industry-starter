## ADDED Requirements

### Requirement: A dock, not a modal
The assistant SHALL be a docked panel beside the page with a header launcher. It SHALL have no `aria-modal`, no focus trap and no scroll lock above the breakpoint where two things fit; below it the panel is a full-screen sheet with scroll lock. It SHALL be absent in in-store mode and when `ASSISTANT_ENABLED` is not `true`.

#### Scenario: Page stays usable
- **WHEN** the panel is open on desktop
- **THEN** the page behind it can still be scrolled and clicked

#### Scenario: In-store mode
- **WHEN** `APP_MODE=instore`
- **THEN** no launcher renders and the routes answer 503

### Requirement: Session starts on first open
The session SHALL start when the panel first opens. Text typed before the session is ready SHALL be queued and sent on ready; the composer is never disabled for the handshake.

#### Scenario: Typing during handshake
- **WHEN** the shopper types and sends before the session is ready
- **THEN** the message appears and is sent once ready

### Requirement: Panel-opened is counted on the edge
"Assistant opened" SHALL be tracked once per closed-to-open edge, detected outside any state updater, through one path used by both `open()` and `toggle()`.

#### Scenario: Strict mode
- **WHEN** React StrictMode double-invokes updaters
- **THEN** one event is recorded per open

### Requirement: Six cards, no invented data
The panel SHALL render products, comparison, plan, guide, order status and checkout cards from enriched server payloads. The price-history sparkline, review-sentiment bars, delivery-promise, low-stock and returns chips of the reference SHALL NOT exist.

#### Scenario: Partial frames
- **WHEN** a card streams in
- **THEN** arrays render a trailing skeleton and layout does not settle early

#### Scenario: Retry hold
- **WHEN** a card payload fails validation
- **THEN** the card dims and holds its last frame until the corrected call arrives

### Requirement: Panel width
Cards SHALL use container queries so they fit a 480 to 560 px dock; a viewport breakpoint SHALL NOT drive a card layout. All colour comes from one scoped token layer that maps onto the Malva tokens and is imported in the Tailwind base layer.

#### Scenario: 480 px dock
- **WHEN** the comparison card renders in a 480 px panel
- **THEN** it is one column and nothing overflows horizontally

#### Scenario: Launcher legibility
- **THEN** the launcher label and icon colour come from a utility class and are visible

### Requirement: Language and currency
Every visible string (about ninety) SHALL come from `messages/<locale>.json` under namespace `assistant`, identical keys in `en-US` and `en-CA`, ICU messages for "from {price}". Money SHALL be formatted by one module with two hooks (major-units from agent payloads, minor-units from cent-exact fields) that read locale and currency from the app and cannot be called without them. The assistant SHALL answer in the shopper's language.

#### Scenario: Missing key
- **WHEN** a component references an `assistant.*` key a catalogue lacks
- **THEN** the scrape test fails before the build

#### Scenario: Canadian shopper
- **WHEN** an `en-CA` shopper sees a price
- **THEN** it is formatted in CAD with the right magnitude

### Requirement: Safe text and links
Model and catalogue text SHALL render as React text nodes only (no HTML-emitting markdown). Links SHALL be same-origin storefront paths or the validated order permalink. A card action that leaves the conversation SHALL use client-side navigation so the panel and transcript survive.

#### Scenario: HTML in text
- **WHEN** a product title contains `<img onerror=...>`
- **THEN** it appears as text

### Requirement: Showcase page
A fixture-driven page SHALL render every card in every slot state and locale for review and tests, gated by a server variable available at request time (`ASSISTANT_SHOWCASE=true`) and absent in production.

#### Scenario: Production
- **WHEN** the variable is unset
- **THEN** the page is a 404

### Requirement: Accessibility
The panel SHALL be keyboard operable, announce new assistant messages politely, label the launcher, and meet the 4.5:1 text contrast of the storefront tokens.

#### Scenario: Keyboard
- **WHEN** the shopper tabs through the panel
- **THEN** every control is reachable and Escape closes the panel and returns focus to the launcher
