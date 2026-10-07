## ADDED Requirements

### Requirement: Static content pages

`/[locale]/about`, `/[locale]/faq`, `/[locale]/policies/[slug]` (delivery, returns, privacy, terms) and `/[locale]/journal` SHALL render from message catalogs or markdown files per locale in the Organic look (kicker, H1, 16px/1.75 body at 78% text, max width 720px), with `generateMetadata` titles.

#### Scenario: German About page
- **WHEN** `/de-DE/about` is opened
- **THEN** German content renders with a German title

### Requirement: FAQ

The FAQ SHALL render questions as keyboard-accessible disclosures (one open at a time optional) grouped by topic.

#### Scenario: Toggle answer
- **WHEN** a visitor activates a question
- **THEN** its answer expands and `aria-expanded` is true

### Requirement: Contact us

`/[locale]/contact` SHALL show a form with name, email, topic and message, validate on the server, and on success show a confirmation. The submit SHALL be a stub that logs the message server-side and delivers nothing; the page SHALL not claim delivery to a person.

#### Scenario: Valid submit
- **WHEN** valid data is submitted
- **THEN** the confirmation is shown and the server logs the message without PII beyond what the form collected

#### Scenario: Invalid email
- **WHEN** the email is malformed
- **THEN** an inline error is shown and nothing is submitted

### Requirement: Journal placeholder and reviews placeholder

The journal SHALL render a single static article using the editorial layout. The product reviews block SHALL render only when the product has review data and otherwise SHALL be omitted without a gap.

#### Scenario: No reviews
- **WHEN** a product has no review data
- **THEN** the reviews block is not rendered

### Requirement: Footer and navigation links

Footer columns and the concierge/contact strips SHALL link to these pages with locale-aware links.

#### Scenario: Contact strip
- **WHEN** a visitor clicks "Contact us" on the homepage
- **THEN** the contact page opens in the same locale
