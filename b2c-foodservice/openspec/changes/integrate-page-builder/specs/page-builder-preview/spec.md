## ADDED Requirements

### Requirement: Separate gate-free preview deployment
Draft preview SHALL run against a separate deployment of the storefront that has no demo gate and that may be framed by Merchant Center. The production deployment SHALL stay gated and unframeable.

#### Scenario: Production not framable
- **WHEN** a page of `https://omni-industry-starter.netlify.app` is requested
- **THEN** the response has `frame-ancestors 'none'` and `X-Frame-Options: DENY`

#### Scenario: Preview framable by Merchant Center only
- **WHEN** a page of the preview deployment is requested
- **THEN** `frame-ancestors` lists only `https://food-service.mc-preview.us-central1.gcp.commercetools.com` and no `X-Frame-Options: DENY` is sent

### Requirement: Framing is an environment switch
The relaxed framing policy SHALL be enabled by an environment variable, off by default, so it cannot reach production through a code change alone. The existing security-header tests SHALL cover both states.

#### Scenario: Default is deny
- **WHEN** the variable is unset
- **THEN** the headers equal today's headers

### Requirement: Draft token
A request that carries `pb_preview` with the shared token SHALL render draft content. Any other value SHALL render the published page. The storefront SHALL forward the query string to the service and SHALL never build or expose these parameters for shoppers.

#### Scenario: Valid token
- **WHEN** the editor frames `/en-US?pb_preview=<token>&pb_page_id=<id>`
- **THEN** the draft of that page is shown

#### Scenario: Wrong token
- **WHEN** the token does not match
- **THEN** the published page is shown

#### Scenario: Shopper path
- **WHEN** a shopper navigates the site
- **THEN** no link, redirect or response header contains `pb_preview`

### Requirement: Gate bypass for the editor frame
A cookie-based gate SHALL NOT be relied on inside the cross-site frame. The preview deployment SHALL have the gate disabled.

#### Scenario: Frame loads without a cookie
- **WHEN** Merchant Center frames the preview deployment with no prior cookie
- **THEN** the page loads and does not redirect to `/gate`

### Requirement: Edit mode
On the preview deployment, `pb_edit=1` SHALL enable the visual-editing bridge, restricted to `pb_origin` values the service lists as allowed. Editable text SHALL be marked so it can be edited in place; the markers SHALL be inert for shoppers.

#### Scenario: Edit in place
- **WHEN** an author edits a banner heading in the frame
- **THEN** the heading updates in the editor and the draft

#### Scenario: Inert on production
- **WHEN** a production page is rendered
- **THEN** no bridge script is mounted

### Requirement: Origins recorded
Every storefront origin SHALL be listed in the service's render origins and in the Merchant Center app's frame sources, and Merchant Center's origin SHALL be in the service's editor origins: production, preview, and local development.

#### Scenario: New preview origin
- **WHEN** the preview URL is known
- **THEN** it is added to both allowlists before the first preview is attempted
