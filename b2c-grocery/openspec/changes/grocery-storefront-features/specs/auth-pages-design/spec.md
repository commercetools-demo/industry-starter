## ADDED Requirements

### Requirement: Sign-in page

`/[locale]/account/sign-in` SHALL show a 440px card with H2 "Sign in", email and password fields, a primary block button, links to register and reset, and a `redirect` query honored after success. Failure SHALL show one generic message that does not reveal whether the email exists.

#### Scenario: Wrong password
- **WHEN** the password is wrong
- **THEN** the generic message "Email or password is incorrect" is shown

#### Scenario: Return after sign-in
- **WHEN** a visitor signs in from `?redirect=/en-US/saved`
- **THEN** they land on that page and their anonymous cart is merged

### Requirement: Registration with auto-verification

`/[locale]/account/register` SHALL collect first name, last name, email and password (minimum 8 characters), create the customer, immediately create and confirm the email token server-side so the customer is verified, sign the customer in and merge the anonymous cart. No email SHALL be sent.

#### Scenario: Register
- **WHEN** a visitor registers with valid data
- **THEN** the customer exists with `isEmailVerified = true` and is signed in

#### Scenario: Duplicate email
- **WHEN** the email is already registered
- **THEN** a message says the account cannot be created and offers sign-in, without confirming account existence in more detail than necessary

### Requirement: Password reset

`/[locale]/account/forgot-password` SHALL accept an email and always answer with the same confirmation. The server SHALL create a password-reset token when the customer exists. In development only, a stub page SHALL render the reset link; in production no link is shown. `/[locale]/account/reset-password?token=…` SHALL set a new password and sign the customer in.

#### Scenario: Unknown email
- **WHEN** an unknown email is submitted
- **THEN** the same confirmation appears as for a known email

#### Scenario: Dev stub
- **WHEN** running in development and a token is created
- **THEN** the stub shows the reset link; in production it does not

### Requirement: Protected account routes

Routes under `/[locale]/account/*` except sign-in, register, forgot and reset SHALL require a signed-in session and otherwise redirect to sign-in with `redirect` set.

#### Scenario: Anonymous visits orders
- **WHEN** an anonymous visitor opens `/en-US/account/orders`
- **THEN** they are redirected to sign-in with the return path

### Requirement: Visual design

All auth pages SHALL use the 440px dialog-style card on the surface color with radius `lg×1.15`, labelled `.field` inputs, visible inline errors with `aria-describedby`, and a primary block button.

#### Scenario: Validation error
- **WHEN** a field is invalid
- **THEN** its error is displayed under the field and announced to assistive technology
