## ADDED Requirements

### Requirement: Every submission is recorded before Intake is called
Because Intake has no get, list or status endpoint, the storefront SHALL create an intake record for the signed-in client's Business Unit, with status `processing`, before calling Intake, and SHALL update it when the call ends.

#### Scenario: Record created first
- **WHEN** a submission is accepted
- **THEN** a `processing` record exists with output type, file names and creation time before the Intake call starts

#### Scenario: Call ends
- **WHEN** Intake succeeds or fails
- **THEN** the same record becomes `done` or `failed` with completion time, and for success the entity reference

### Requirement: Recent intakes list
The `/account/intake` page SHALL list the Business Unit's recent intakes, newest first, each showing status, output type, file names, time, warnings or error, and (when done) the created entity's type and id. Rows SHALL be read-only.

#### Scenario: List after submit
- **WHEN** a client submits a new intake
- **THEN** they land on the list where the new row shows In progress, and it changes to Done or Failed without a manual reload

#### Scenario: Empty list
- **WHEN** the Business Unit has no intakes
- **THEN** the page shows an empty state with the form

#### Scenario: Other units are not shown
- **WHEN** another Business Unit has intakes
- **THEN** they are not listed, the unit being taken from the session

### Requirement: Stale processing records
A `processing` record older than the stale threshold SHALL be shown as failed with a "did not finish" reason and SHALL stop being refreshed.

#### Scenario: Function died mid-call
- **WHEN** a record has been `processing` longer than the threshold
- **THEN** the list shows it as failed and polling stops for it

### Requirement: Records are bounded
The list SHALL show at most the most recent 50 records.

#### Scenario: More than 50
- **WHEN** a unit has more than 50 records
- **THEN** only the newest 50 are listed
