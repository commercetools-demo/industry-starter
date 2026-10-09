# Checkout (Request a quote) — design spec

Checkout = **Request a quote / contact**: a 3-step form, no payment. Source: `Malva.html`, route `#quote`.
Behaviour: `openspec/changes/malva-website/specs/malva-request-a-quote/spec.md`.

## Layout

Page header "Request a quote" / "Three short steps. We reply within one working day." Then `2fr / 1fr`, gap 48px.

**Left — stepper + form**

Stepper: `1 Service · 2 Site · 3 Contact`. Active step navy with underline; completed step green with ✓; stepper scrolls horizontally < 900px.

| Step | Fields |
| --- | --- |
| 1 Service | Radio option cards: **Plumbing** (Pipework, drains, testing, boilers) · **Waste management** (Collection, recycling, hazardous, clinical) · **Both** (One combined contract). Textarea "What do you need? (optional)", placeholder "e.g. quarterly grease trap servicing and drain survey". |
| 2 Site | Company · Sector (Facilities management / Manufacturing / Property / real estate / Healthcare / Other) · Site address · Number of sites (1 / 2–10 / 11–50 / 50+). |
| 3 Contact | Full name · Job title · Work email · Phone. Button reads **Submit request**. |

Buttons: **Back** (outline, from step 2) and **Continue** (primary). On success the form is replaced by a green block: "Request received. Thanks {name} — our commercial team will contact you within one working day."

**Right — aside card** "Prefer to talk?": Commercial team, Mon–Fri 7:30–18:00 · `0800 555 0100` · `quotes@malva.example` · divider · "Emergency? Contracted clients: call 0800 555 0142, 24/7."

## Validation (as prototyped)

Step 1 requires a service ("Please choose a service."). Step 2 requires company ("Please enter your company name."). Step 3 requires a valid email ("Please enter a valid email address."). Values persist when going Back.

## Decided after the first review (owner answers, 2026-10-08)

- **Account required:** a Quote Request cannot come from an anonymous cart, so step 3 for a visitor is "Create your account and submit": name, job title, work email, phone, **password** (min 10 chars), consent line. Submitting creates the account (auto-verified, no email), the company and the Quote Request; the visitor ends signed in on the confirmation with a link to "Quotes and requests". Existing email → "An account may already exist. Sign in" keeping all entries.
- **No email** anywhere in this release: confirmation is on screen with a reference number; the team reads requests in the Merchant Center.
- Site address from step 2 becomes the cart shipping address (required by the platform); multiple sites in v1 = one request per site address, with "Add another site" after the confirmation.
- Sample proof content is labelled "Sample content" (see `homepage.md`).

## Proposed changes

- **Specific services**: when arriving from the quote list or a PDP, step 1 shows the chosen services (editable) instead of the 3-way choice, which stays as the fallback for "not sure yet".
- **Sector** preselected from `?sector=` (audience cards) and from the signed-in client's account.
- **Signed-in client**: steps 2–3 prefilled from the business unit and contact; the client may pick one of their existing sites.
- Required: also name (step 3) and phone-or-email; consent line "We use these details only to respond to your request" with a privacy-policy link.
- Spam protection that does not hurt accessibility (honeypot + rate limit; CAPTCHA only on abuse).
- Confirmation shows a reference number and emails a copy.
- Healthcare / hazardous: optional "Waste types" and "Permit or licence number" fields shown only when relevant services are chosen.

## States

Submitting: button disabled with progress label. Failure: error block above the buttons, entered data kept. Success: confirmation; refreshing does not resubmit.

## Gaps vs. design

Prototype sends nothing ("Sample form"); error messages are not announced; no consent text; no file upload for site plans or survey reports (propose optional, ≤ 10 MB, PDF/JPG/PNG).

## Acceptance

1. Each error is tied to its field (`aria-describedby`, `aria-invalid`) and announced via a live region; focus moves to the first invalid field.
2. Steps are reachable and operable by keyboard; step changes move focus to the step heading.
3. A submitted request creates exactly one record even on double-click or retry.
4. The sales inbox receives the request with every field and the selected services.
