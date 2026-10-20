## ADDED Requirements

### Requirement: Submit files or text to Intake for a chosen output
The storefront SHALL let a signed-in client submit up to 3 files and/or free text to the Intake API and choose the output as Cart, Shopping list or Quote request. The chosen output SHALL be sent as `outputType`; it SHALL NOT be inferred.

#### Scenario: Files become a cart
- **WHEN** a client attaches a purchase order PDF, selects Cart and submits
- **THEN** one multipart request with a `payload` part (`outputType` Cart, locale, prompt) and the file under a `files` part is sent to the Intake endpoint

#### Scenario: Text only
- **WHEN** a client submits free text without files
- **THEN** a JSON request with `outputType`, `locale` and `prompt` is sent

#### Scenario: Nothing to submit
- **WHEN** a client submits with no files and no text
- **THEN** the form reports that a file or text is required and nothing is sent

### Requirement: File limits are enforced before sending
The form and the server SHALL accept only PDF, TXT, CSV, DOCX, XLSX, EML, Markdown and HTML files, at most 3 per submission and at most 20 MB each.

#### Scenario: Fourth file
- **WHEN** a client adds a fourth file
- **THEN** it is refused with a message naming the limit of 3

#### Scenario: Unsupported or oversized file
- **WHEN** a file of another type, or over 20 MB, is chosen
- **THEN** it is refused with a message naming the file and the reason, and the server rejects it too if it arrives anyway

### Requirement: Shopping list requires a name
When the output is Shopping list the form SHALL require a list name and send it in the prompt. Cart and Quote request submissions SHALL NOT show the field.

#### Scenario: Missing list name
- **WHEN** Shopping list is selected and the name is empty
- **THEN** the form blocks submission and names the missing field

### Requirement: The signed-in identity is sent to Intake
The server SHALL add the signed-in customer's email and Business Unit to the prompt, taken from the session and never from the request body, so that Intake does not fail for a missing customer.

#### Scenario: Identity comes from the session
- **WHEN** a request body names a different email or Business Unit
- **THEN** the prompt still carries the session's customer email and Business Unit

#### Scenario: Signed out
- **WHEN** a request arrives without a session
- **THEN** it is refused with 401 and Intake is not called

### Requirement: Intake is called over raw HTTP with a scoped token
The server SHALL call `POST /{projectKey}/agents/intake/v1/responses` with an access token holding `manage_intake_agent:{projectKey}`. The client secret and token SHALL NOT reach the browser.

#### Scenario: Success is recorded
- **WHEN** Intake answers 201 with a created entity
- **THEN** the intake record is marked done with the entity type, its id (and `cartId` for a Quote Request) and any warnings

#### Scenario: Intake refuses
- **WHEN** Intake answers with an error such as `MissingCustomerEmail` or `ProductsNotFound`
- **THEN** the record is marked failed with the machine-readable code and a safe message, and the raw upstream body is not exposed
