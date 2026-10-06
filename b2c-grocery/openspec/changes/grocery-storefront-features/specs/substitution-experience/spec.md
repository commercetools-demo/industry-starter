## ADDED Requirements

### Requirement: Per-line preference

Each cart line SHALL show a substitution control with options "Allow similar" and "No substitution", persisted on the line item custom field `substitutionPreference`. The default SHALL be "Allow similar" for chilled and fresh products and "No substitution" otherwise, and the preference SHALL survive onto the placed order.

#### Scenario: Change preference
- **WHEN** a shopper switches a line to "No substitution"
- **THEN** the line item custom field is updated and shown after reload

#### Scenario: Preference on order
- **WHEN** an order is placed
- **THEN** order detail shows each line's preference

### Requirement: Pending proposal on order detail

Order detail SHALL list each unapplied Order Edit of custom type `substitution-proposal` with `status = pending` as a notice naming the original product, the proposed substitute, the price difference and the new total preview, with "Accept" and "Decline" actions. Orders without proposals SHALL show no such notice.

#### Scenario: Proposal exists
- **WHEN** an order has a pending proposal
- **THEN** order detail shows it with price difference and both actions

### Requirement: Accept applies the edit

Accepting SHALL apply the Order Edit with its current `editVersion` and `resourceVersion` server-side, then refresh the order and show the substitute on the line.

#### Scenario: Accept
- **WHEN** the shopper accepts
- **THEN** the Order Edit is applied, the order shows the substitute and the proposal disappears

#### Scenario: Stale version
- **WHEN** the order changed since the proposal was created and apply fails with a version conflict
- **THEN** the page refetches and shows the current proposal state or an explanation

### Requirement: Decline records a removal request

Declining SHALL set the Order Edit custom field `status` to `declined` and show the line as "Removal requested"; no substitute is added.

#### Scenario: Decline
- **WHEN** the shopper declines
- **THEN** the proposal is marked declined and the line shows "Removal requested"

### Requirement: Eligibility

Order detail SHALL only show Accept/Decline for orders whose inventory mode is `None` and whose state allows edits; otherwise it SHALL show the proposal read-only with a contact link.

#### Scenario: Order already shipped
- **WHEN** an order is no longer editable
- **THEN** Accept and Decline are not offered
